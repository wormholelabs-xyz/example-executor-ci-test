import { createPublicClient, createWalletClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { vaaV1ReceiveWithGasDropAbi } from "../../abis/vaaV1ReceiveWithGasDropoffAbi";
import type { ChainConfig } from "../../chains";
import { EVM_PRIVATE_KEY } from "../../consts";
import type { RelayRequestData, TxInfo } from "../../types";
import {
  getFirstDropOffInstruction,
  getTotalGasLimitAndMsgValue,
  getTotalMsgValueFromGasInstructions,
} from "../../utils";
import {
  deserializeRelayInstructions,
  trimToAddress,
} from "../../layouts/utils";

export const relayVAAv1 = async (
  chainConfig: ChainConfig,
  relayRequest: RelayRequestData,
  base64Vaa: string,
): Promise<Array<TxInfo>> => {
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
};
