import {
  relayInstructionsLayout,
  type RelayInstructions,
} from "@wormhole-foundation/sdk-definitions";
import { deserialize } from "binary-layout";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  fromHex,
  getAddress,
  http,
  isAddressEqual,
  isHex,
  padHex,
  toEventHash,
  toHex,
  trim,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { RequestForExecutionLogABI } from "../../abis/requestForExecutionLog";
import { vaaV1ReceiveWithGasDropAbi } from "../../abis/vaaV1ReceiveWithGasDropoffAbi";
import type { ChainConfig } from "../../chains";
import { EVM_PRIVATE_KEY } from "../../consts";
import type { RequestId } from "../../layouts/requestId";
import type {
  RelayRequestData,
  RequestForExecution,
  TxInfo,
} from "../../types";
import {
  getFirstDropOffInstruction,
  getTotalGasLimitAndMsgValue,
  getTotalMsgValueFromGasInstructions,
} from "../../utils";

const REQUEST_FOR_EXECUTION_TOPIC = toEventHash(
  "RequestForExecution(address,uint256,uint16,bytes32,address,bytes,bytes,bytes)",
);

export type RequestForExecutionWithId = RequestForExecution & {
  id: RequestId;
};

export class EvmHandler {
  private constructor() {}

  static async getGasPrice(chainConfig: ChainConfig): Promise<bigint> {
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
  }

  static async getRequestsForExecution(
    txHash: string,
    chainConfig: ChainConfig,
  ): Promise<Array<RequestForExecutionWithId>> {
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
  }

  static async relayVAAv1(
    chainConfig: ChainConfig,
    relayRequest: RelayRequestData,
    base64Vaa: string,
  ): Promise<Array<TxInfo>> {
    const transport = http(chainConfig.rpc);
    const publicClient = createPublicClient({
      chain: anvil,
      transport,
    });

    const { maxMsgValue, gasDropOffLimit } = chainConfig.capabilities;

    const relayInstructions = deserializeRelayInstructions(
      relayRequest.requestForExecution.relayInstructionsBytes,
    );

    const { gasLimit } = getTotalGasLimitAndMsgValue(
      relayRequest.requestForExecution.relayInstructionsBytes,
    );

    const relayMsgValue = getTotalMsgValueFromGasInstructions(
      relayInstructions,
      maxMsgValue,
    );

    const { dropOff, recipient } = getFirstDropOffInstruction(
      relayInstructions,
      gasDropOffLimit,
    );

    const account = privateKeyToAccount(EVM_PRIVATE_KEY);

    const client = createWalletClient({
      account,
      chain: chainConfig.viemChain,
      transport,
    });

    const payloadHex = toHex(Buffer.from(base64Vaa, "base64"));

    const { request } = await publicClient.simulateContract({
      account,
      address: "0x13b62003C8b126Ec0748376e7ab22F79Fb8bbDF2",
      gas: gasLimit,
      value: relayMsgValue + dropOff,
      abi: vaaV1ReceiveWithGasDropAbi,
      functionName: "receiveMessage",
      args: [
        trimToAddress(relayRequest.requestForExecution.dstAddr),
        payloadHex,
        trimToAddress(toHex(recipient.address)),
        dropOff,
      ],
    });

    const hash = await client.writeContract(request);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash,
    });

    const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
    const blockTime = new Date(Number(block.timestamp) * 1000);

    let totalCostValue =
      receipt.effectiveGasPrice * receipt.gasUsed + (request.value || 0n);

    const txInfo = {
      txHash: receipt.transactionHash,
      chainId: chainConfig.wormholeChainId,
      blockNumber: receipt.blockNumber,
      blockTime,
      cost: totalCostValue,
    };
    return [txInfo];
  }
}

function deserializeRelayInstructions(
  relayInstructionsBytes: `0x${string}`,
): RelayInstructions {
  return deserialize(
    relayInstructionsLayout,
    fromHex(relayInstructionsBytes, "bytes"),
  );
}
function trimToAddress(hex: Hex) {
  return getAddress(
    padHex(trim(hex, { dir: "left" }), { dir: "left", size: 20 }),
  );
}
