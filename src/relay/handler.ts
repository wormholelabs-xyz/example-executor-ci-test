import type { ChainConfig } from "../chains";
import type {
  RelayRequestData,
  RequestForExecutionWithId,
  TxInfo,
} from "../types";

export interface IProtocolHandler {
  getGasPrice(chainConfig: ChainConfig): Promise<bigint>;

  getRequestsForExecution(
    txHash: string,
    chainConfig: ChainConfig,
  ): Promise<Array<RequestForExecutionWithId>>;

  relayVAAv1(
    chainConfig: ChainConfig,
    relayRequest: RelayRequestData,
    base64Vaa: string,
  ): Promise<Array<TxInfo>>;
}
