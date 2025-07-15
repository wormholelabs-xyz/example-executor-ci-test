import { serializeLayout } from "@wormhole-foundation/sdk-base";
import { relayInstructionsLayout } from "@wormhole-foundation/sdk-definitions";
import axios from "axios";
import { sleep } from "bun";
import { expect, test } from "bun:test";
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodeAbiParameters,
  formatUnits,
  getContract,
  http,
  isHex,
  keccak256,
  padHex,
  parseAbiParameters,
  toHex,
  type Account,
  type Chain,
  type PublicClient,
  type WalletClient,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import forgeOutput from "../evm/out/ExecutorVAAv1Integration.sol/ExecutorVAAv1Integration.json";
import { enabledChains } from "./chains";
import { ANVIL_MNEMONIC, NTT_TOKEN_BALANCE_STORE } from "./consts";
import { RelayStatus } from "./types";
import { anvil } from "viem/chains";

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

test("it performs a Ntt v1 relay", async () => {
  const srcChain = enabledChains[10002]!;
  const dstChain = enabledChains[10004]!;
  const account = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 });
  const wNttTokenSepolia = {
    manager: "0x06413c42e913327Bc9a08B7C1E362BAE7C0b9598",
    token: "0x738141EFf659625F2eAD4feECDfCD94155C67f18",
    transceiver: [
      {
        address: "0x649fF7B32C2DE771043ea105c4aAb2D724497238",
        type: "wormhole",
      },
    ],
    shim: "0x54DD7080aE169DD923fE56d0C4f814a0a17B8f41",
  } as const;

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

  const relayInstructions = toHex(
    serializeLayout(relayInstructionsLayout, {
      requests: [
        {
          request: {
            type: "GasInstruction",
            gasLimit: 500000n,
            msgValue: 0n,
          },
        },
      ],
    }),
  );

  const quoteResponse = await axios.post<{
    signedQuote: `0x${string}`;
    estimatedCost: string;
  }>("http://executor:3000/v0/quote", {
    srcChain: 10002,
    dstChain: 10004,
    relayInstructions,
  });

  expect(BigInt(quoteResponse.data.estimatedCost)).toBeGreaterThan(1n);

  await setTokenBalance(
    srcChain.rpc,
    wNttTokenSepolia.token,
    account.address,
    10000000000000000n,
  );

  const transferAmount = 1n * 10n ** (18n - 6n);

  const { request } = await srcPublicClient.simulateContract({
    account,
    address: wNttTokenSepolia.token,
    abi: Erc20TransferABI,
    functionName: "approve",
    args: [wNttTokenSepolia.shim, transferAmount],
  });

  const approvalTx = await srcClient.writeContract(request);
  console.log(`Approval Tx: ${approvalTx}`);

  const approvalReceipt = await srcPublicClient.waitForTransactionReceipt({
    hash: approvalTx,
  });

  expect(approvalReceipt.status).toBe("success");

  const paddedReceiverAddress = padHex(account.address, {
    dir: "left",
    size: 32,
  });

  const { request: transferRequest } = await srcPublicClient.simulateContract({
    account,
    address: wNttTokenSepolia.shim,
    abi: NttWithExecutorTransferABI,
    functionName: "transfer",
    args: [
      wNttTokenSepolia.manager,
      transferAmount,
      dstChain.wormholeChainId,
      paddedReceiverAddress,
      paddedReceiverAddress,
      "0x01000101",
      {
        value: BigInt(quoteResponse.data.estimatedCost),
        refundAddress: account.address,
        signedQuote: quoteResponse.data.signedQuote,
        instructions: relayInstructions,
      },
      {
        payee: account.address,
        dbps: 0,
      },
    ],
    value: BigInt(quoteResponse.data.estimatedCost),
  });
  const hash = await srcClient.writeContract(transferRequest);

  console.log(
    `Request execution: https://wormholelabs-xyz.github.io/executor-explorer/#/chain/10002/tx/${hash}?endpoint=http%3A%2F%2Flocalhost%3A3000&env=Testnet`,
  );

  const transferReceipt = await srcPublicClient.waitForTransactionReceipt({
    hash,
  });

  expect(transferReceipt.status).toBe("success");

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
}, 60000);

const setTokenBalance = async (
  rpc: string,
  tokenAddress: `0x${string}`,
  accountAddress: `0x${string}` = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  balance: bigint = 10000000000000000n,
): Promise<bigint> => {
  const encodedBalanceValue = encodeAbiParameters(
    parseAbiParameters("uint256"),
    [balance],
  );

  const paddedBalanceValue = encodedBalanceValue.slice(2).padStart(64, "0");
  const storageValue = `0x${paddedBalanceValue}` as `0x${string}`;

  const balanceStorageSlot = keccak256(
    encodeAbiParameters(parseAbiParameters("address, bytes32"), [
      accountAddress,
      NTT_TOKEN_BALANCE_STORE,
    ]),
  ) as `0x${string}`;

  const anvilClient = createTestClient({
    chain: anvil,
    mode: "anvil",
    transport: http(rpc),
  });

  try {
    const setStorageResult = await anvilClient.request({
      method: "anvil_setStorageAt",
      params: [tokenAddress, balanceStorageSlot, storageValue],
    });
    console.log("Storage set successfully:", setStorageResult);

    const tokenContract = getContract({
      address: tokenAddress,
      abi: [
        {
          name: "balanceOf",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
        {
          name: "decimals",
          inputs: [],
          outputs: [{ name: "", type: "uint8" }],
          stateMutability: "view",
          type: "function",
        },
        {
          name: "symbol",
          inputs: [],
          outputs: [{ name: "", type: "string" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      client: anvilClient,
    });
    const decimals = await tokenContract.read.decimals();
    const newBalance = await tokenContract.read.balanceOf([accountAddress]);

    console.log(
      `New balance of ${accountAddress}:`,
      newBalance,
      `(${formatUnits(newBalance, decimals)} human-readable)`,
      `Decimals: ${decimals}`,
    );

    return newBalance;
  } catch (error) {
    console.error("Error setting storage:", error);
    throw error;
  }
};

const Erc20TransferABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "guy",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "wad",
        type: "uint256",
      },
    ],
    name: "approve",
    outputs: [
      {
        internalType: "bool",
        name: "",
        type: "bool",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

const NttWithExecutorTransferABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "nttManager",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint16",
        name: "recipientChain",
        type: "uint16",
      },
      {
        internalType: "bytes32",
        name: "recipientAddress",
        type: "bytes32",
      },
      {
        internalType: "bytes32",
        name: "refundAddress",
        type: "bytes32",
      },
      {
        internalType: "bytes",
        name: "encodedInstructions",
        type: "bytes",
      },
      {
        components: [
          {
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
          {
            internalType: "address",
            name: "refundAddress",
            type: "address",
          },
          {
            internalType: "bytes",
            name: "signedQuote",
            type: "bytes",
          },
          {
            internalType: "bytes",
            name: "instructions",
            type: "bytes",
          },
        ],
        internalType: "struct ExecutorArgs",
        name: "executorArgs",
        type: "tuple",
      },
      {
        components: [
          {
            internalType: "uint16",
            name: "dbps",
            type: "uint16",
          },
          {
            internalType: "address",
            name: "payee",
            type: "address",
          },
        ],
        internalType: "struct FeeArgs",
        name: "feeArgs",
        type: "tuple",
      },
    ],
    name: "transfer",
    outputs: [
      {
        internalType: "uint64",
        name: "msgId",
        type: "uint64",
      },
    ],
    stateMutability: "payable",
    type: "function",
  },
];
