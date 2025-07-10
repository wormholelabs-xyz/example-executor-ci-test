import { mnemonicToAccount } from "viem/accounts";
import { ANVIL_MNEMONIC } from "./consts";
import { test } from "bun:test";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  padHex,
  toHex,
} from "viem";
import { anvil, sepolia } from "viem/chains";
import { serializeLayout } from "@wormhole-foundation/sdk-base";
import {
  quoteLayout,
  relayInstructionsLayout,
  signedQuoteLayout,
} from "@wormhole-foundation/sdk-definitions";
import axios from "axios";
import { deserialize } from "binary-layout";

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

test("it performs a VAA v1 relay", async () => {
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
  const response = await axios.post("http://localhost:3000/v0/quote", {
    srcChain: 10002,
    dstChain: 10004,
    relayInstructions,
  });
  const transport = http("http://localhost:8545");
  const account = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 });
  const client = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });
  const testContract = getContract({
    address: "0x8e98Bd10a6f4c1Ee0C4b5d9F50a18D1a7E20EaF8",
    abi: ABI,
    client,
  });
  const tx = await testContract.write.incrementAndSend(
    [
      10004,
      padHex("0x7d77360666066967579a2235332d271587cd62dC", {
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
    `https://wormholelabs-xyz.github.io/executor-explorer/#/chain/10002/tx/${tx}?endpoint=http%3A%2F%2Flocalhost%3A3000&env=Testnet`,
  );
});
