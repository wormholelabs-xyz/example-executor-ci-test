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
  rpc: string,
  txHash: Hex,
  coreContractAddress: Hex,
): Promise<VAA<"Uint8Array"> | undefined> {
  console.log(`Mocking guardian signatures for ${rpc} ${txHash}`);
  const transport = http(rpc);
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

  for (const topic of topics) {
    if (
      topic.removed === false &&
      isAddressEqual(topic.address, coreContractAddress)
    ) {
      const emitter = topic.args.sender;
      const paddedEmitter = padHex(emitter, { dir: "left", size: 32 });
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

      const vaaId = `${chainId}/${padHex(emitter, { dir: "left", size: 32 }).substring(2)}/${topic.args.sequence.toString()}`;
      if (
        vaaId ===
        `${chainId}/${paddedEmitter.substring(2)}/${vaa.sequence.toString()}`
      ) {
        return vaa;
      }
    }
  }
}

/**
 * returns a base64 string like a guardian /v1/signed_vaa/
 */
export async function mockWormhole(
  rpc: string,
  txHash: Hex,
  coreContractAddress: Hex,
  vaaId: string,
): Promise<string> {
  const vaa = await getWormholeMessage(rpc, txHash, coreContractAddress);

  if (!vaa) {
    throw new Error(`Vaa not found for txHash: ${txHash} and Vaa ID ${vaaId}`);
  }

  const guardianSet = new mocks.MockGuardians(0, [
    EVM_PRIVATE_KEY.substring(2),
  ]);
  const signedVaa = guardianSet.addSignatures(vaa);
  return Buffer.from(serialize(signedVaa)).toString("base64");
}
