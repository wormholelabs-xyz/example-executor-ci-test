import type { Hex } from "viem";
import type { ChainConfig } from "../chains";
import type { RequestId } from "../layouts/requestId";
import type {
  NttTransceiverMessageId,
  NttTransceiverPayload,
  RelayRequestData,
  RequestForExecutionWithId,
  TxInfo,
} from "../types";
import type { VAA } from "@wormhole-foundation/sdk-definitions";

export interface IProtocolHandler {
  getGasPrice(chainConfig: ChainConfig): Promise<bigint>;

  getRequestsForExecution(
    txHash: string,
    chainConfig: ChainConfig,
  ): Promise<Array<RequestForExecutionWithId>>;

  getWormholeVaaIds(chainConfig: ChainConfig, txHash: Hex): Promise<string[]>;

  relayVAAv1(
    chainConfig: ChainConfig,
    relayRequest: RelayRequestData,
    base64Vaa: string,
  ): Promise<Array<TxInfo>>;

  relayNTTv1(
    chainConfig: ChainConfig,
    relayRequest: RelayRequestData,
    transceiversPayload: NttTransceiverPayload[],
  ): Promise<TxInfo[]>;

  getNttTransferMessages(
    chainConfig: ChainConfig,
    id: RequestId,
    address: `0x${string}`,
    messageId: `0x${string}`,
  ): Promise<NttTransceiverMessageId[]>;
}
