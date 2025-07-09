import { RequestPrefix, type Capabilities } from "./types";

export interface ChainConfig {
  wormholeChainId: number;
  evmChainId: number;
  rpc: string;
  name: string;
  gasPriceDecimals: number;
  nativeDecimals: number;
  capabilities: Capabilities;
}

export const enabledChains: Record<number, ChainConfig> = {
  10002: {
    wormholeChainId: 10002,
    evmChainId: 11155111,
    rpc: "http://anvil-eth-sepolia:8545",
    name: "Ethereum Sepolia",
    gasPriceDecimals: 18,
    nativeDecimals: 18,
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
    capabilities: {
      requestPrefixes: [RequestPrefix.ERV1],
      gasDropOffLimit: 100_000_000_000n,
      maxGasLimit: 1_000_000n,
      maxMsgValue: 100_000_000_000n * 2n,
    },
  },
};
