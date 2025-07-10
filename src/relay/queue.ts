import {
  RelayAbortedError,
  RelayStatus,
  UnsupportedRelayRequestError,
  type RelayRequestData,
  type TxInfo,
} from "../types";

class InMemoryRelayRequestQueue {
  private store: Map<string, Array<RelayRequestData>> = new Map();

  async enqueueAndProcess(
    key: RelayRequestKey,
    requests: Array<RelayRequestData>,
    callback: (data: RelayRequestData) => Promise<Array<TxInfo>>,
  ): Promise<void> {
    this.store.set(this.relayKeyToString(key), requests);

    for (const relayData of requests) {
      let txInfos: Array<TxInfo> = [];
      try {
        txInfos = await callback(relayData);
      } catch (e: unknown) {
        relayData.status = RelayStatus.Failed;

        if (e instanceof UnsupportedRelayRequestError) {
          relayData.status = RelayStatus.Unsupported;
        }

        if (e instanceof RelayAbortedError) {
          relayData.status = RelayStatus.Aborted;
        }

        relayData.failureCause = e instanceof Error ? e.message : String(e);

        continue;
      }

      relayData.status = RelayStatus.Submitted;
      relayData.txs = txInfos;
    }

    this.store.set(this.relayKeyToString(key), requests);
  }

  getRequest = (key: RelayRequestKey): Array<RelayRequestData> | undefined =>
    this.store.get(this.relayKeyToString(key));

  relayKeyToString = (key: RelayRequestKey): string =>
    `${key.chainId}/${key.txHash}`;
}

export type RelayRequestKey = {
  txHash: string;
  chainId: number;
};

export const messageQueue = new InMemoryRelayRequestQueue();
