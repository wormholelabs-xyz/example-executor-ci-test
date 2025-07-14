import { isHex } from "viem";
import { enabledChains } from "../chains";
import { mockWormhole } from "../mockGuardian";
import {
  RelayAbortedError,
  RequestPrefix,
  UnsupportedRelayRequestError,
  type RelayRequestData,
  type TxInfo,
} from "../types";
import { evmHandler } from "./evm";

export const processRelayRequests = async (
  relayRequest: RelayRequestData,
): Promise<Array<TxInfo>> => {
  const srcChainConfig = enabledChains[relayRequest.chainId];
  const dstChainConfig =
    enabledChains[relayRequest.requestForExecution.dstChain];

  console.log(
    `Relaying ${relayRequest.id} of type ${relayRequest.instruction?.request.prefix}`,
  );

  if (!srcChainConfig) {
    throw new RelayAbortedError(
      `Error in chain configuration: Source Chain ID ${relayRequest.chainId} not configured.`,
    );
  }

  if (!dstChainConfig) {
    throw new RelayAbortedError(
      `Error in chain configuration: Destination Chain ID ${relayRequest.chainId} not configured.`,
    );
  }

  if (!relayRequest.instruction) {
    throw new RelayAbortedError(
      `Relay Request of ID ${relayRequest.id} without instruction set, aborting.`,
    );
  }

  const { request } = relayRequest.instruction;
  const { prefix } = request;

  if (!dstChainConfig.capabilities.requestPrefixes.includes(prefix)) {
    throw new UnsupportedRelayRequestError(
      `Request type of ${relayRequest.instruction.request.prefix} not supported for Chain ID ${relayRequest.chainId}`,
    );
  }

  let relayedTransactions: Array<TxInfo> = [];

  switch (prefix) {
    case RequestPrefix.ERV1:
      if (!isHex(relayRequest.txHash)) {
        throw new Error(`TxHash not hex!`);
      }
      if (!isHex(srcChainConfig.coreContractAddress)) {
        throw new Error(`Core contract not hex!`);
      }
      const base64Vaa = await mockWormhole(
        srcChainConfig.rpc,
        relayRequest.txHash,
        srcChainConfig.coreContractAddress,
      );
      relayedTransactions = await evmHandler.relayVAAv1(
        dstChainConfig,
        relayRequest,
        base64Vaa,
      );
      break;
    case RequestPrefix.ERC2:
    case RequestPrefix.ERC1:
    case RequestPrefix.ERM1:
    case RequestPrefix.ERN1:
    default:
      throw new UnsupportedRelayRequestError(
        `Request of type ${prefix} not supported.`,
      );
  }

  return relayedTransactions;
};
