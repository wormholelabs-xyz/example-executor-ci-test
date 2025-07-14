import type { SignedQuote } from "@wormhole-foundation/sdk-definitions";
import type { RequestLayout } from "./layouts/request";
import type { RequestId } from "./layouts/requestId";

export enum RequestPrefix {
  ERM1 = "ERM1", // MM
  ERV1 = "ERV1", // VAA_V1
  ERN1 = "ERN1", // NTT_V1
  ERC1 = "ERC1", // CCTP_V1
  ERC2 = "ERC2", // CCTP_V2
}

export type Capabilities = {
  requestPrefixes: Array<keyof typeof RequestPrefix>;
  gasDropOffLimit: bigint;
  maxGasLimit: bigint;
  maxMsgValue: bigint;
};

export type RequestForExecutionWithId = RequestForExecution & {
  id: RequestId;
};

export type RequestForExecution = {
  quoterAddress: `0x${string}`;
  amtPaid: bigint;
  dstChain: number;
  dstAddr: `0x${string}`;
  refundAddr: `0x${string}`;
  signedQuoteBytes: `0x${string}`;
  requestBytes: `0x${string}`;
  relayInstructionsBytes: `0x${string}`;
  timestamp: Date;
};

export type RelayRequestData = {
  id: `0x${string}`;
  chainId: number;
  estimatedCost: bigint;
  indexedAt: Date;
  instruction?: RequestLayout;
  requestForExecution: RequestForExecution;
  signedQuote: SignedQuote;
  status: RelayStatus;
  txHash: string;
  failureCause?: string;
  txs?: Array<TxInfo>;
};

export type TxInfo = {
  txHash: string;
  chainId: number;
  blockNumber: bigint;
  blockTime: Date | null;
  cost: bigint;
};

export enum RelayStatus {
  Pending = "pending",
  Failed = "failed",
  Unsupported = "unsupported",
  Submitted = "submitted",
  Underpaid = "underpaid",
  Aborted = "aborted",
}

export class RelayAbortedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RelayAbortedError";
  }
}

export class UnsupportedRelayRequestError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "UnsupportedRelayRequestError";
  }
}
