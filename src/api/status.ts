import { type Request, type Response } from "express";
import { messageQueue } from "../relay/queue";
import {
  EvmHandler,
  type RequestForExecutionWithId,
} from "../relay/platform/evm";
import { enabledChains, type ChainConfig } from "../chains";
import {
  RelayStatus,
  type Capabilities,
  type RelayRequestData,
} from "../types";
import {
  fromHex,
  isAddressEqual,
  isHex,
  recoverAddress,
  toHex,
  keccak256,
} from "viem";
import { deserialize, serialize } from "binary-layout";
import {
  quoteLayout,
  signedQuoteLayout,
  type SignedQuote,
} from "@wormhole-foundation/sdk-definitions";
import { QUOTER_PUBLIC_KEY } from "../consts";
import { estimateQuote, getTotalGasLimitAndMsgValue } from "../utils";
import {
  deserializeRequestForExecution,
  type RequestLayout,
} from "../layouts/request";
import { serializeRequestId } from "../layouts/requestId";
import { processRelayRequests } from "../relay/relayer";

function isPositiveWholeNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value === Math.floor(value)
  );
}

export const statusHandler = async (req: Request, res: Response) => {
  try {
    const enabledChainIds = Object.keys(enabledChains);
    const chainId = req.body?.chainId;
    const txHash = req.body?.txHash;

    if (typeof txHash !== "string" || !txHash) {
      return res
        .status(400)
        .json({ message: "txHash must be a valid string." });
    }

    if (chainId && !isPositiveWholeNumber(chainId)) {
      return res
        .status(400)
        .json({ message: "chainId, if defined, must be a number." });
    }

    if (!enabledChainIds.includes(chainId.toString())) {
      res
        .status(400)
        .send(
          `Unsupported chainId: ${chainId}, supported chains: ${enabledChainIds.join(
            ",",
          )}`,
        );
      return;
    }

    const chainConfig = enabledChains[parseInt(chainId)];

    if (!chainConfig) {
      res.status(500).send("Internal error: Invalid chain configuration");
      return;
    }

    const existentRelayRequestData = messageQueue.getRequest({
      txHash,
      chainId,
    });

    if (existentRelayRequestData && existentRelayRequestData.length > 0) {
      res.status(200).json(existentRelayRequestData);
    }

    const requestsForExecution = await EvmHandler.getRequestsForExecution(
      txHash,
      chainConfig,
    );

    const relayRequests: Array<RelayRequestData> = [];

    for (const rfe of requestsForExecution) {
      const dstChainConfig = enabledChains[rfe.dstChain];

      if (!dstChainConfig) {
        res.status(500).send("Internal error: Invalid chain configuration");
        return;
      }

      const transaction = await verifyAndCreateTransaction(
        rfe,
        chainConfig,
        dstChainConfig,
      );

      relayRequests.push(transaction);
    }

    // Fire and forget - simulating async processing
    messageQueue.enqueueAndProcess(
      { chainId, txHash },
      relayRequests,
      processRelayRequests,
    );

    return res.status(200).json(relayRequests);
  } catch (error) {
    console.error("Error handling status request:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
};

async function verifyAndCreateTransaction(
  rfe: RequestForExecutionWithId,
  srcChainConfig: ChainConfig,
  dstChainConfig: ChainConfig,
): Promise<RelayRequestData> {
  const txHash = rfe.id.hash;
  const chainId = rfe.id.chain;

  const signedQuote: SignedQuote = deserialize(
    signedQuoteLayout,
    fromHex(rfe.signedQuoteBytes, "bytes"),
  );

  await verifySignedQuote(signedQuote);

  const { gasLimit, msgValue } = getTotalGasLimitAndMsgValue(
    rfe.relayInstructionsBytes,
  );

  const estimatedCost = estimateQuote(
    signedQuote,
    gasLimit,
    msgValue,
    srcChainConfig.gasPriceDecimals,
    srcChainConfig.nativeDecimals,
    dstChainConfig.nativeDecimals,
  );

  const instruction = deserializeRequestForExecution(rfe.requestBytes);
  const id = serializeRequestId(rfe.id);

  const status = getRelayStatus(
    txHash,
    dstChainConfig.capabilities,
    rfe.amtPaid,
    estimatedCost,
    gasLimit,
    msgValue,
    instruction,
  );

  return {
    id: id,
    chainId: chainId,
    estimatedCost: estimatedCost,
    indexedAt: new Date(),
    instruction: instruction,
    requestForExecution: {
      amtPaid: rfe.amtPaid,
      dstAddr: rfe.dstAddr,
      dstChain: rfe.dstChain,
      quoterAddress: rfe.quoterAddress,
      refundAddr: rfe.refundAddr,
      requestBytes: rfe.requestBytes,
      relayInstructionsBytes: rfe.relayInstructionsBytes,
      signedQuoteBytes: rfe.signedQuoteBytes,
      timestamp: rfe.timestamp,
    },
    signedQuote,
    status: status,
    txHash: txHash,
    txs: [],
  };
}

async function verifySignedQuote(signedQuote: SignedQuote): Promise<void> {
  if (
    !isAddressEqual(QUOTER_PUBLIC_KEY, toHex(signedQuote.quote.quoterAddress))
  ) {
    throw new Error(
      `Bad quoterAddress. Expected: ${QUOTER_PUBLIC_KEY}, Received: ${signedQuote.quote.quoterAddress}`,
    );
  }
  if (!isHex(signedQuote.signature)) {
    throw new Error(`Bad signature`);
  }
  const recoveredPublicKey = await recoverAddress({
    hash: keccak256(serialize(quoteLayout, signedQuote)),
    signature: signedQuote.signature,
  });
  if (
    !isAddressEqual(recoveredPublicKey, toHex(signedQuote.quote.quoterAddress))
  ) {
    throw new Error(
      `Bad quote signature recovery. Expected: ${signedQuote.quote.quoterAddress}, Received: ${recoveredPublicKey}`,
    );
  }
}

export function getRelayStatus(
  txHash: string,
  dstCapabilities: Capabilities,
  amtPaid: bigint,
  estimatedCost: bigint,
  gasLimit: bigint,
  msgValue: bigint,
  instruction: RequestLayout,
) {
  const { maxMsgValue, maxGasLimit, requestPrefixes } = dstCapabilities;
  const isSupportedGasLimit = gasLimit <= maxGasLimit;
  const isSupportedMsgValue = msgValue <= maxMsgValue;

  const isSupportedRequestPrefix = requestPrefixes.includes(
    instruction.request.prefix,
  );

  if (!isSupportedRequestPrefix) {
    console.warn(
      `Unsupported request prefix ${instruction.request.prefix} for txHash ${txHash}. Supported prefixes are ${requestPrefixes.join(", ")}`,
    );
  }

  if (!isSupportedGasLimit) {
    console.warn(
      `Unsupported gasLimit ${gasLimit} for ${txHash} as it exceeds the maximum allowed gasLimit ${maxGasLimit}.`,
    );
  }

  if (!isSupportedMsgValue) {
    console.warn(
      `Unsupported msgValue ${msgValue} for ${txHash} as it exceeds the maximum allowed msgValue ${maxGasLimit}.`,
    );
  }

  const isSupported =
    isSupportedRequestPrefix && isSupportedGasLimit && isSupportedMsgValue;

  if (!isSupported) {
    return RelayStatus.Unsupported;
  }

  return amtPaid < estimatedCost ? RelayStatus.Underpaid : RelayStatus.Pending;
}
