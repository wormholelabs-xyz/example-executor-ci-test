import { defineChain, type Chain } from "viem";
import { type Capabilities } from "./types";
import { readFileSync, existsSync } from "fs";

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
  nttMultiReceiveWithGasDropOffAddress: string;
  viemChain?: Chain;
}

export interface CustomChainConfig extends Omit<ChainConfig, "viemChain"> {
  viemChainName: string;
  viemTokenName: string;
  viemTokenSymbol: string;
}

function loadChainsConfig(): Record<number, ChainConfig> {
  const chains: Record<number, ChainConfig> = {};

  const configPath = process.env.CHAIN_CONFIG_PATH || "/config/chains.json";

  if (existsSync(configPath)) {
    try {
      const fileContent = readFileSync(configPath, "utf-8");
      const customChainsData = JSON.parse(fileContent) as Record<
        string,
        CustomChainConfig
      >;

      for (const [chainId, config] of Object.entries(customChainsData)) {
        const capabilities = {
          ...config.capabilities,
          gasDropOffLimit: BigInt(config.capabilities.gasDropOffLimit),
          maxGasLimit: BigInt(config.capabilities.maxGasLimit),
          maxMsgValue: BigInt(config.capabilities.maxMsgValue),
        };

        const chainConfig: ChainConfig = {
          ...config,
          capabilities,
          viemChain: defineChain({
            id: config.evmChainId,
            nativeCurrency: {
              decimals: config.nativeDecimals,
              name: config.viemTokenName,
              symbol: config.viemTokenSymbol,
            },
            name: config.viemChainName,
            rpcUrls: {
              default: {
                http: [config.rpc],
              },
            },
          }),
        };
        chains[Number(chainId)] = chainConfig;
      }
    } catch (error) {
      console.error("Failed to load custom chains from", configPath, error);
    }
  }

  return chains;
}

export const enabledChains: Record<number, ChainConfig> = {
  ...loadChainsConfig(),
};
