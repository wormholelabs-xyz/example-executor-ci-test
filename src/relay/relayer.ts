import { fromHex, isHex } from "viem";
import { enabledChains } from "../chains";
import { mockWormhole } from "../mockGuardian";
import {
  RelayAbortedError,
  RequestPrefix,
  UnsupportedRelayRequestError,
  type NttTransceiverPayload,
  type RelayRequestData,
  type TxInfo,
} from "../types";
import { evmHandler } from "./evm";
import { requestIdLayout } from "../layouts/requestId";
import { deserialize } from "binary-layout";
import { trimToAddress } from "../layouts/utils";

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

  if (!isHex(relayRequest.txHash)) {
    throw new Error(`TxHash not hex!`);
  }

  if (!isHex(srcChainConfig.coreContractAddress)) {
    throw new Error(`Core contract not hex!`);
  }

  let relayedTransactions: Array<TxInfo> = [];

  switch (prefix) {
    case RequestPrefix.ERV1:
      const vaaId = `${request.chain}/${request.address.substring(2)}/${request.sequence.toString()}`;

      const payload = await mockWormhole(
        srcChainConfig.rpc,
        relayRequest.txHash,
        srcChainConfig.coreContractAddress,
        vaaId,
      );
      if (!payload) {
        throw new Error("No Vaa found for the transaction.");
      }

      relayedTransactions = await evmHandler.relayVAAv1(
        dstChainConfig,
        relayRequest,
        payload,
      );
      break;
    case RequestPrefix.ERN1:
      const messages = await evmHandler.getNttTransferMessages(
        srcChainConfig,
        deserialize(requestIdLayout, fromHex(relayRequest.id, "bytes")),
        trimToAddress(request.srcManager),
        request.messageId,
      );

      const messagesWithPayloads: NttTransceiverPayload[] = [];
      for (const message of messages) {
        if (message.type === "wormhole") {
          const payload = await mockWormhole(
            srcChainConfig.rpc,
            relayRequest.txHash,
            srcChainConfig.coreContractAddress,
            message.id,
          );
          if (!payload) {
            throw new Error(
              `Expected Vaa for id ${message.id} has not been found`,
            );
          }
          messagesWithPayloads.push({ ...message, payload });
        }
      }

      relayedTransactions = await evmHandler.relayNTTv1(
        dstChainConfig,
        relayRequest,
        messagesWithPayloads,
      );
      break;
    case RequestPrefix.ERC2:
    case RequestPrefix.ERC1:
    default:
      throw new UnsupportedRelayRequestError(
        `Request of type ${prefix} not supported.`,
      );
  }

  return relayedTransactions;
};
