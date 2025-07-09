import { type Request, type Response } from "express";
import { enabledChains, type ChainConfig } from "../chains";
import { isHex, padHex, toBytes } from "viem";
import type { Quote } from "@wormhole-foundation/sdk-definitions";
import {
  PAYEE_PUBLIC_KEY,
  QUOTER_PRIVATE_KEY,
  QUOTER_PUBLIC_KEY,
} from "../consts";
import {
  estimateQuote,
  getTotalGasLimitAndMsgValue,
  signQuote,
} from "../utils";

function getChainConfig(chainId: string): ChainConfig | undefined {
  const numericId = parseInt(chainId);
  return enabledChains[numericId];
}

export const quoteHandler = async (req: Request, res: Response) => {
  const enabledChainIds = Object.keys(enabledChains);

  const srcChainId = req.body.srcChain;
  const dstChainId = req.body.dstChain;
  const relayInstructions = req.body.relayInstructions;

  if (relayInstructions && !isHex(relayInstructions)) {
    res.status(400).send(`Invalid hex string for "relayInstructions"`);
    return;
  }

  if (!enabledChainIds.includes(srcChainId.toString())) {
    res
      .status(400)
      .send(
        `Unsupported source chain: ${srcChainId}, supported chains: ${enabledChainIds.join(
          ","
        )}`
      );
    return;
  }

  if (!enabledChainIds.includes(dstChainId.toString())) {
    res
      .status(400)
      .send(
        `Unsupported destination chain: ${dstChainId}, supported chains: ${enabledChainIds.join(
          ","
        )}`
      );
    return;
  }

  const srcChain = getChainConfig(srcChainId);
  const dstChain = getChainConfig(dstChainId);

  if (!srcChain || !dstChain) {
    res.status(500).send("Internal error: Invalid chain configuration");
    return;
  }

  const expiryTime = new Date();

  expiryTime.setHours(expiryTime.getHours() + 1);

  const quote: Quote = {
    quote: {
      prefix: "EQ01",
      quoterAddress: toBytes(QUOTER_PUBLIC_KEY),
      payeeAddress: toBytes(
        padHex(PAYEE_PUBLIC_KEY, {
          dir: "left",
          size: 32,
        })
      ),
      srcChain: parseInt(srcChainId),
      dstChain: parseInt(dstChainId),
      expiryTime,
      baseFee: 1n,
      dstGasPrice: 100n,
      srcPrice: 10000000000n,
      dstPrice: 10000000000n,
    },
  };

  const signedQuote = await signQuote(quote, QUOTER_PRIVATE_KEY);

  let response: {
    signedQuote: `0x${string}`;
    estimatedCost?: bigint;
  } = {
    signedQuote,
  };

  if (relayInstructions) {
    const { gasLimit, msgValue } =
      getTotalGasLimitAndMsgValue(relayInstructions);

    if (gasLimit > dstChain.capabilities.maxGasLimit) {
      res
        .status(400)
        .send(
          `Request exceeds maxGasLimit: ${gasLimit.toString()} requested, ${dstChain.capabilities.maxGasLimit.toString()} maximum.`
        );
      return;
    }

    if (msgValue > dstChain.capabilities.maxMsgValue) {
      res
        .status(400)
        .send(
          `Request exceeds maxMsgValue: ${msgValue.toString()} requested, ${dstChain.capabilities.maxMsgValue.toString()} maximum.`
        );
      return;
    }

    response.estimatedCost = estimateQuote(
      quote,
      gasLimit,
      msgValue,
      dstChain.gasPriceDecimals,
      srcChain.nativeDecimals,
      dstChain.nativeDecimals
    );
  }
  res.status(200).json(response);
};
