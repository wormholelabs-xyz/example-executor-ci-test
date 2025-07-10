import type { Chain } from "viem";
import { RequestPrefix, type Capabilities } from "./types";
import { baseSepolia, sepolia } from "viem/chains";

export interface ChainConfig {
  wormholeChainId: number;
  evmChainId: number;
  executorAddress: string;
  rpc: string;
  name: string;
  gasPriceDecimals: number;
  nativeDecimals: number;
  capabilities: Capabilities;
  coreContractAddress: string;
  viemChain?: Chain;
}

export const enabledChains: Record<number, ChainConfig> = {
  10002: {
    wormholeChainId: 10002,
    evmChainId: 11155111,
    rpc: "http://anvil-eth-sepolia:8545",
    name: "Ethereum Sepolia",
    gasPriceDecimals: 18,
    nativeDecimals: 18,
    executorAddress: "0xD0fb39f5a3361F21457653cB70F9D0C9bD86B66B",
    coreContractAddress: "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78",
    viemChain: sepolia,
    capabilities: {
      requestPrefixes: [RequestPrefix.ERV1],
      gasDropOffLimit: 100_000_000_000n,
      maxGasLimit: 1_000_000n,
      maxMsgValue: 100_000_000_000n * 2n,
    },
  },
  10004: {
    wormholeChainId: 10004,
    evmChainId: 84532,
    rpc: "http://anvil-base-sepolia:8545",
    name: "Base Sepolia",
    gasPriceDecimals: 18,
    nativeDecimals: 18,
    viemChain: baseSepolia,
    coreContractAddress: "0x79A1027a6A159502049F10906D333EC57E95F083",
    executorAddress: "0x51B47D493CBA7aB97e3F8F163D6Ce07592CE4482",
    capabilities: {
      requestPrefixes: [RequestPrefix.ERV1],
      gasDropOffLimit: 100_000_000_000n,
      maxGasLimit: 1_000_000n,
      maxMsgValue: 100_000_000_000n * 2n,
    },
  },
};
