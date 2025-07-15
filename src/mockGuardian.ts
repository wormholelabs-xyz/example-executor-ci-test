import { toChain } from "@wormhole-foundation/sdk-base";
import {
  createVAA,
  serialize,
  UniversalAddress,
  type VAA,
} from "@wormhole-foundation/sdk-definitions";
import { mocks } from "@wormhole-foundation/sdk-definitions/testing";
import {
  createPublicClient,
  getContract,
  http,
  isAddressEqual,
  padHex,
  parseEventLogs,
  toBytes,
  type Hex,
} from "viem";
import { anvil } from "viem/chains";
import { CORE_ABI } from "./abis/core";
import { EVM_PRIVATE_KEY } from "./consts";
import type { ChainConfig } from "./chains";

async function getWormholeMessage(
  chainConfig: ChainConfig,
  txHash: Hex,
  coreContractAddress: Hex,
): Promise<Record<string, VAA<"Uint8Array">> | undefined> {
  console.log(`Mocking guardian signatures for ${chainConfig.rpc} ${txHash}`);
  const transport = http(chainConfig.rpc);
  const client = createPublicClient({
    chain: anvil,
    transport,
  });
  const transaction = await client.getTransactionReceipt({
    hash: txHash,
  });
  const coreContract = getContract({
    address: coreContractAddress,
    abi: CORE_ABI,
    client,
  });
  const chainId = await coreContract.read.chainId();
  const guardianSetIndex = await coreContract.read.getCurrentGuardianSetIndex();
  const topics = parseEventLogs({
    eventName: "LogMessagePublished",
    abi: CORE_ABI,
    logs: transaction.logs,
  });
  const transactionVAAs: Record<string, VAA<"Uint8Array">> = {};

  // @TODO - Emitter + Sequence
  for (const topic of topics) {
    if (
      topic.removed === false &&
      isAddressEqual(topic.address, coreContractAddress)
    ) {
      const emitter = topic.args.sender;
      const vaa = createVAA("Uint8Array", {
        guardianSet: guardianSetIndex,
        timestamp: Number(
          (
            await client.getBlock({
              blockHash: transaction.blockHash,
              includeTransactions: false,
            })
          ).timestamp,
        ),
        // NOTE: the Wormhole SDK requires this be a known chain, though that is not strictly necessary for our use case.
        emitterChain: toChain(chainId),
        emitterAddress: new UniversalAddress(
          toBytes(padHex(emitter, { dir: "left", size: 32 })),
        ),
        consistencyLevel: topic.args.consistencyLevel,
        sequence: topic.args.sequence,
        nonce: topic.args.nonce,
        signatures: [],
        payload: toBytes(topic.args.payload),
      });

      const vaaId = `${chainConfig.wormholeChainId}/${padHex(emitter, { dir: "left", size: 32 }).substring(2)}/${topic.args.sequence.toString()}`;

      transactionVAAs[vaaId] = vaa;
    }
  }

  return transactionVAAs;
}

/**
 * returns a base64 string like a guardian /v1/signed_vaa/
 */
export async function mockWormhole(
  chainConfig: ChainConfig,
  txHash: Hex,
  coreContractAddress: Hex,
  vaaId: string,
): Promise<string> {
  const vaas = await getWormholeMessage(
    chainConfig,
    txHash,
    coreContractAddress,
  );
  if (!vaas) {
    throw new Error(`Vaa not found for txHash: ${txHash}.`);
  }

  console.log(Object.keys(vaas));

  const expectedVaa = vaas[vaaId];

  if (!expectedVaa) {
    throw new Error(`Vaa not found for vaa ID: ${vaaId}.`);
  }

  const guardianSet = new mocks.MockGuardians(0, [
    EVM_PRIVATE_KEY.substring(2),
  ]);
  const signedVaa = guardianSet.addSignatures(expectedVaa);
  return Buffer.from(serialize(signedVaa)).toString("base64");
}
