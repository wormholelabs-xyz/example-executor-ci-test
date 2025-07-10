import { enabledChains } from "../chains";
import {
  RelayAbortedError,
  RequestPrefix,
  UnsupportedRelayRequestError,
  type RelayRequestData,
  type TxInfo,
} from "../types";
import { EvmHandler } from "./platform/evm";

export const processRelayRequests = async (
  relayRequest: RelayRequestData,
): Promise<Array<TxInfo>> => {
  const chainConfig = enabledChains[relayRequest.chainId];

  console.log(
    `Relaying ${relayRequest.id} of type ${relayRequest.instruction?.request.prefix}`,
  );

  if (!chainConfig) {
    throw new RelayAbortedError(
      `Error in chain configuration: Chain ID ${relayRequest.chainId} not configured.`,
    );
  }

  if (!relayRequest.instruction) {
    throw new RelayAbortedError(
      `Relay Request of ID ${relayRequest.id} without instruction set, aborting.`,
    );
  }

  const { request } = relayRequest.instruction;
  const { prefix } = request;

  if (!chainConfig.capabilities.requestPrefixes.includes(prefix)) {
    throw new UnsupportedRelayRequestError(
      `Request type of ${relayRequest.instruction.request.prefix} not supported for Chain ID ${relayRequest.chainId}`,
    );
  }

  let relayedTransactions: Array<TxInfo> = [];

  switch (prefix) {
    case RequestPrefix.ERV1:
      relayedTransactions = await EvmHandler.relayVAAv1(
        chainConfig,
        relayRequest,
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
