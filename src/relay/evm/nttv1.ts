import "@wormhole-foundation/sdk-definitions-ntt";
import {
  createPublicClient,
  createWalletClient,
  fromBytes,
  getContract,
  http,
  isAddressEqual,
  isHex,
  padHex,
  parseEventLogs,
  type Address,
  type Hex,
} from "viem";
import { anvil } from "viem/chains";
import type { ChainConfig } from "../../chains";
import type { RequestId } from "../../layouts/requestId";
import { deserializePayload } from "@wormhole-foundation/sdk-definitions";
import type {
  NttTransceiver,
  NttTransceiverMessageId,
  NttTransceiverPayload,
  RelayRequestData,
  TxInfo,
} from "../../types";
import {
  deserializeRelayInstructions,
  trimToAddress,
} from "../../layouts/utils";
import {
  getFirstDropOffInstruction,
  getTotalGasLimitAndMsgValue,
} from "../../utils";
import { privateKeyToAccount } from "viem/accounts";
import { EVM_PRIVATE_KEY } from "../../consts";
import { nttV1multiReceiveWithGasDropOffAbi } from "../../abis/nttV1MultiReceiveWithGasDropOff";

export const getEnabledTransceivers = async (
  chainConfig: ChainConfig,
  address: `0x${string}`,
): Promise<NttTransceiver[]> => {
  const transport = http(chainConfig.rpc);

  const publicClient = createPublicClient({
    chain: anvil,
    transport,
    batch: { multicall: true },
  });

  const transceiverAddresses = await getContract({
    address,
    abi: [
      {
        inputs: [],
        name: "getTransceivers",
        outputs: [
          { internalType: "address[]", name: "result", type: "address[]" },
        ],
        stateMutability: "pure",
        type: "function",
      },
    ],
    client: publicClient,
  }).read.getTransceivers();

  const getTransceiverType = async (address: `0x${string}`) => {
    try {
      return (
        await getContract({
          address,
          abi: [
            {
              type: "function",
              name: "getTransceiverType",
              inputs: [],
              outputs: [{ name: "", type: "string", internalType: "string" }],
              stateMutability: "view",
            },
          ],
          client: publicClient,
        }).read.getTransceiverType()
      )
        .replaceAll("\n", "")
        .replaceAll("\u0000", ""); // fix for a \n and a bunch of \u0000
    } catch (e) {
      return "wormhole";
    }
  };

  const transceiverTypes = await Promise.all(
    transceiverAddresses.map(getTransceiverType),
  );
  return transceiverAddresses.map((address, idx) => ({
    address,
    type: transceiverTypes[idx]!,
  }));
};

export const getNttTransferMessages = async (
  chainConfig: ChainConfig,
  id: RequestId,
  address: `0x${string}`,
  messageId: `0x${string}`,
): Promise<NttTransceiverMessageId[]> => {
  if (id.type !== "Evm") {
    throw new Error(`Received a non-Evm request type ${id.type}`);
  }
  const transport = http(chainConfig.rpc);
  const publicClient = createPublicClient({
    chain: anvil,
    transport,
    batch: { multicall: true },
  });

  const transaction = await publicClient.getTransactionReceipt({
    hash: id.hash,
  });

  const transceivers = await getEnabledTransceivers(chainConfig, address);
  const supportedMessages = [];
  for (const transceiver of transceivers) {
    if (transceiver.type === "wormhole") {
      const wormhole = await getContract({
        address: transceiver.address,
        abi: [
          {
            type: "function",
            name: "wormhole",
            inputs: [],
            outputs: [
              {
                name: "",
                type: "address",
                internalType: "contract IWormhole",
              },
            ],
            stateMutability: "view",
          },
        ],
        client: publicClient,
      }).read.wormhole({});
      const topics = parseEventLogs({
        eventName: "LogMessagePublished",
        abi: [
          {
            type: "event",
            name: "LogMessagePublished",
            inputs: [
              {
                name: "sender",
                type: "address",
                indexed: true,
                internalType: "address",
              },
              {
                name: "sequence",
                type: "uint64",
                indexed: false,
                internalType: "uint64",
              },
              {
                name: "nonce",
                type: "uint32",
                indexed: false,
                internalType: "uint32",
              },
              {
                name: "payload",
                type: "bytes",
                indexed: false,
                internalType: "bytes",
              },
              {
                name: "consistencyLevel",
                type: "uint8",
                indexed: false,
                internalType: "uint8",
              },
            ],
            anonymous: false,
          },
        ],
        logs: transaction.logs,
      });

      for (const topic of topics) {
        if (
          topic.removed === false &&
          isAddressEqual(topic.address, wormhole) &&
          isAddressEqual(
            (topic.args as { sender: Address }).sender,
            transceiver.address,
          )
        ) {
          const payload = deserializePayload(
            "Ntt:WormholeTransfer",
            (topic.args as { payload: Uint8Array | string }).payload,
          );
          const hexId = fromBytes(payload.nttManagerPayload.id, "hex");
          if (messageId === hexId) {
            if (transceiver.type === "wormhole") {
              supportedMessages.push({
                ...transceiver,
                id: `${chainConfig.wormholeChainId}/${padHex(transceiver.address, { dir: "left", size: 32 }).substring(2)}/${(topic.args as { sequence: number }).sequence.toString()}`,
              });
            } else {
              const transceiverType: never = transceiver.type;
              throw new Error(`Unsupported type: ${transceiverType}`);
            }
          }
        }
      }
    }
  }
  return supportedMessages;
};

export const relayNTTv1 = async (
  chainConfig: ChainConfig,
  relayRequest: RelayRequestData,
  transceiversPayload: NttTransceiverPayload[],
): Promise<TxInfo[]> => {
  const transport = http(chainConfig.rpc);
  const publicClient = createPublicClient({
    chain: chainConfig.viemChain,
    transport,
  });

  const relayInstructions = deserializeRelayInstructions(
    relayRequest.requestForExecution.relayInstructionsBytes,
  );
  const { gasLimit } = getTotalGasLimitAndMsgValue(
    relayRequest.requestForExecution.relayInstructionsBytes,
  );
  const { dropOff, recipient } = getFirstDropOffInstruction(
    relayInstructions,
    chainConfig.capabilities.gasDropOffLimit,
  );
  const transceivers = await getEnabledTransceivers(
    chainConfig,
    trimToAddress(relayRequest.requestForExecution.dstAddr),
  );

  const matchedTransceivers: Hex[] = [];
  const matchedMessages: Hex[] = [];

  for (const transceiverMessage of transceiversPayload) {
    for (const transceiver of transceivers) {
      if (transceiver.type === transceiverMessage.type) {
        matchedTransceivers.push(transceiver.address);
        matchedMessages.push(
          fromBytes(Buffer.from(transceiverMessage.payload, "base64"), "hex"),
        );
      }
    }
  }

  try {
    const account = privateKeyToAccount(EVM_PRIVATE_KEY);

    const client = createWalletClient({
      account,
      chain: chainConfig.viemChain,
      transport,
    });

    if (!isHex(chainConfig.nttMultiReceiveWithGasDropOffAddress)) {
      throw new Error(
        "The defined value for nttMultiReceiveWithGasDropOffAddress in chain config isn't a valid Hex string",
      );
    }

    const { request } = await publicClient.simulateContract({
      account,
      address: chainConfig.nttMultiReceiveWithGasDropOffAddress,
      gas: gasLimit,
      value: dropOff,
      abi: nttV1multiReceiveWithGasDropOffAbi,
      functionName: "receiveMessages",
      args: [
        matchedTransceivers,
        matchedMessages,
        trimToAddress(fromBytes(recipient.address, "hex")),
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
  } catch (e: unknown) {
    console.error(e);

    throw e;
  }
};
