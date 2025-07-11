import { serializeLayout } from "@wormhole-foundation/sdk-base";
import { relayInstructionsLayout } from "@wormhole-foundation/sdk-definitions";
import axios from "axios";
import { sleep } from "bun";
import { expect, test } from "bun:test";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  isHex,
  padHex,
  toHex,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import forgeOutput from "../evm/out/ExecutorVAAv1Integration.sol/ExecutorVAAv1Integration.json";
import { enabledChains } from "./chains";
import { ANVIL_MNEMONIC } from "./consts";
import { RelayStatus } from "./types";

const ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "_wormhole", type: "address", internalType: "address" },
      { name: "_executor", type: "address", internalType: "address" },
      {
        name: "_wormholeFinality",
        type: "uint8",
        internalType: "uint8",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "emitterAddress",
    inputs: [],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "executor",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IExecutor" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "incrementAndSend",
    inputs: [
      {
        name: "destinationChain",
        type: "uint16",
        internalType: "uint16",
      },
      {
        name: "destinationAddress",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "executorArgs",
        type: "tuple",
        internalType: "struct ExecutorArgs",
        components: [
          {
            name: "refundAddress",
            type: "address",
            internalType: "address",
          },
          { name: "signedQuote", type: "bytes", internalType: "bytes" },
          { name: "instructions", type: "bytes", internalType: "bytes" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "number",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ourChain",
    inputs: [],
    outputs: [{ name: "", type: "uint16", internalType: "uint16" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "wormhole",
    inputs: [],
    outputs: [
      { name: "", type: "address", internalType: "contract IWormhole" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "wormholeFinality",
    inputs: [],
    outputs: [{ name: "", type: "uint8", internalType: "uint8" }],
    stateMutability: "view",
  },
] as const;

async function deployIntegrationContract(
  publicClient: PublicClient,
  client: WalletClient,
  account: Account,
  viemChain: Chain,
  coreContractAddress: string,
  executorAddress: string,
) {
  if (!isHex(forgeOutput.bytecode.object)) {
    throw new Error("invalid bytecode");
  }
  if (!isHex(coreContractAddress)) {
    throw new Error("invalid coreContractAddress");
  }
  if (!isHex(executorAddress)) {
    throw new Error("invalid executorAddress");
  }
  const hash = await client.deployContract({
    account,
    chain: viemChain,
    abi: ABI,
    bytecode: forgeOutput.bytecode.object,
    args: [coreContractAddress, executorAddress, 200],
  });
  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
  });
  if (!isHex(receipt.contractAddress)) {
    throw new Error("invalid contractAddress");
  }
  return receipt.contractAddress;
}

test("it performs a VAA v1 relay", async () => {
  const srcChain = enabledChains[10002]!;
  const dstChain = enabledChains[10004]!;
  const account = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 });
  if (!srcChain.viemChain || !dstChain.viemChain) {
    throw new Error("invalid viem chain");
  }
  const srcTransport = http(srcChain.rpc);
  const srcPublicClient = createPublicClient({
    chain: srcChain.viemChain,
    transport: srcTransport,
  });
  const srcClient = createWalletClient({
    account,
    chain: srcChain.viemChain,
    transport: srcTransport,
  });
  const dstTransport = http(dstChain.rpc);
  const dstPublicClient = createPublicClient({
    chain: dstChain.viemChain,
    transport: dstTransport,
  });
  const dstClient = createWalletClient({
    account,
    chain: dstChain.viemChain,
    transport: dstTransport,
  });
  const srcContract = await deployIntegrationContract(
    srcPublicClient,
    srcClient,
    account,
    srcChain.viemChain,
    srcChain.coreContractAddress,
    srcChain.executorAddress,
  );
  console.log(`Deployed source contract: ${srcContract}`);
  const dstContract = await deployIntegrationContract(
    dstPublicClient,
    dstClient,
    account,
    dstChain.viemChain,
    dstChain.coreContractAddress,
    dstChain.executorAddress,
  );
  console.log(`Deployed destination contract: ${dstContract}`);
  const dstTestContract = getContract({
    address: srcContract,
    abi: ABI,
    client: srcClient,
  });
  expect(await dstTestContract.read.number()).toBe(0n);
  const relayInstructions = toHex(
    serializeLayout(relayInstructionsLayout, {
      requests: [
        {
          request: {
            type: "GasInstruction",
            gasLimit: 250000n,
            msgValue: 0n,
          },
        },
      ],
    }),
  );
  const response = await axios.post("http://executor:3000/v0/quote", {
    srcChain: 10002,
    dstChain: 10004,
    relayInstructions,
  });
  const srcTestContract = getContract({
    address: srcContract,
    abi: ABI,
    client: srcClient,
  });
  const hash = await srcTestContract.write.incrementAndSend(
    [
      10004,
      padHex(dstContract, {
        dir: "left",
        size: 32,
      }),
      {
        instructions: relayInstructions,
        refundAddress: account.address,
        signedQuote: response.data.signedQuote,
      },
    ],
    { value: BigInt(response.data.estimatedCost) },
  );
  console.log(
    `Request execution: https://wormholelabs-xyz.github.io/executor-explorer/#/chain/10002/tx/${hash}?endpoint=http%3A%2F%2Flocalhost%3A3000&env=Testnet`,
  );
  await srcPublicClient.waitForTransactionReceipt({
    hash,
  });
  let statusResult;
  while (
    !statusResult ||
    statusResult.data?.[0].status === RelayStatus.Pending
  ) {
    console.log(`Statusing tx: ${hash}`);
    if (statusResult) {
      await sleep(1000);
    }
    statusResult = await axios.post("http://executor:3000/v0/status/tx", {
      chainId: srcChain.wormholeChainId,
      txHash: hash,
    });
    if (statusResult.data.length !== 1) {
      throw new Error(`unexpected status result length`);
    }
  }
  expect(statusResult.data?.[0].status).toBe(RelayStatus.Submitted);
  expect(await srcTestContract.read.number()).toBe(1n);
  expect(await dstTestContract.read.number()).toBe(1n);
}, 60000);
