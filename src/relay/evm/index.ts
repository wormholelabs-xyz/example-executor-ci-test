import {
  createPublicClient,
  decodeEventLog,
  http,
  isAddressEqual,
  isHex,
  toEventHash,
} from "viem";
import { anvil } from "viem/chains";
import { RequestForExecutionLogABI } from "../../abis/requestForExecutionLog";
import type { ChainConfig } from "../../chains";
import type { RequestForExecutionWithId } from "../../types";
import type { IProtocolHandler } from "../handler";
import { relayVAAv1 } from "./vaav1";

const REQUEST_FOR_EXECUTION_TOPIC = toEventHash(
  "RequestForExecution(address,uint256,uint16,bytes32,address,bytes,bytes,bytes)",
);

export const evmHandler: IProtocolHandler = {
  getGasPrice: async (chainConfig: ChainConfig): Promise<bigint> => {
    try {
      const transport = http(chainConfig.rpc);
      const client = createPublicClient({
        chain: anvil,
        transport,
      });
      return await client.getGasPrice();
    } catch (e) {
      throw new Error(`unable to determine gas price`);
    }
  },

  getRequestsForExecution: async (
    txHash: string,
    chainConfig: ChainConfig,
  ): Promise<Array<RequestForExecutionWithId>> => {
    const results: Array<RequestForExecutionWithId> = [];

    if (!isHex(txHash)) {
      throw new Error(`Invalid txHash ${txHash}`);
    }

    try {
      const transport = http(chainConfig.rpc);
      const client = createPublicClient({
        chain: anvil,
        transport,
      });

      const transactionReceipt = await client.getTransactionReceipt({
        hash: txHash,
      });

      const block = await client.getBlock({
        blockNumber: transactionReceipt.blockNumber,
      });

      if (!transactionReceipt) return results;

      for (
        let logIndex = 0;
        logIndex < transactionReceipt.logs.length;
        logIndex++
      ) {
        const log = transactionReceipt.logs[logIndex];

        if (
          log &&
          log.removed === false &&
          isAddressEqual(
            log.address,
            chainConfig.executorAddress as `0x${string}`,
          ) &&
          log.topics.length === 2 &&
          log.topics[0] === REQUEST_FOR_EXECUTION_TOPIC
        ) {
          const {
            args: {
              quoterAddress,
              amtPaid,
              dstChain,
              dstAddr,
              refundAddr,
              signedQuote: signedQuoteBytes,
              requestBytes,
              relayInstructions: relayInstructionsBytes,
            },
          } = decodeEventLog({
            abi: RequestForExecutionLogABI,
            topics: log.topics,
            data: log.data,
          });

          results.push({
            id: {
              type: "Evm",
              chain: chainConfig.wormholeChainId,
              hash: transactionReceipt.transactionHash,
              logIndex: BigInt(logIndex),
            },
            amtPaid,
            dstAddr,
            dstChain: Number(dstChain),
            quoterAddress,
            refundAddr,
            signedQuoteBytes,
            requestBytes,
            relayInstructionsBytes,
            timestamp: new Date(Number(block.timestamp) * 1000),
          });
        }
      }
    } catch (e) {
      console.error(e);
    }

    return results;
  },

  relayVAAv1: relayVAAv1,
};
