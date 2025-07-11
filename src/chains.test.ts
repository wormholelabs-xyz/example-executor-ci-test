import { beforeEach, describe, expect, test, mock, spyOn } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { RequestPrefix } from "./types";
import { chainToChainId } from "@wormhole-foundation/sdk-base";

const mockExistsSync = mock(existsSync);
const mockReadFileSync = mock(readFileSync);

mock.module("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

describe("Custom Chain Loading", () => {
  beforeEach(() => {
    mockExistsSync.mockClear();
    mockReadFileSync.mockClear();

    delete process.env.CHAIN_CONFIG_PATH;
    delete process.env.CUSTOM_CHAINS;
  });

  test("loads custom chains from file when file exists", async () => {
    const mockCustomChainData = {
      "10003": {
        wormholeChainId: 10003,
        evmChainId: 421614,
        rpc: "https://sepolia-rollup.arbitrum.io/rpc",
        name: "Arbitrum Sepolia",
        gasPriceDecimals: 18,
        nativeDecimals: 18,
        executorAddress: "0x1234567890123456789012345678901234567890",
        coreContractAddress: "0x0987654321098765432109876543210987654321",
        viemChainName: "arbitrumSepolia",
        viemTokenName: "Ether",
        viemTokenSymbol: "ETH",
        capabilities: {
          requestPrefixes: ["ERV1"],
          gasDropOffLimit: "100000000000",
          maxGasLimit: "1000000",
          maxMsgValue: "200000000000",
        },
      },
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(mockCustomChainData));

    delete require.cache[require.resolve("./chains")];
    const { enabledChains } = await import("./chains");

    expect(mockExistsSync).toHaveBeenCalledWith("/config/chains.json");
    expect(mockReadFileSync).toHaveBeenCalledWith(
      "/config/chains.json",
      "utf-8",
    );

    expect(enabledChains[10003]).toBeDefined();
    expect(enabledChains[10003]!.name).toBe("Arbitrum Sepolia");
    expect(enabledChains[10003]!.evmChainId).toBe(421614);

    expect(enabledChains[10003]!.capabilities.gasDropOffLimit).toBe(
      100000000000n,
    );
    expect(enabledChains[10003]!.capabilities.maxGasLimit).toBe(1000000n);
    expect(enabledChains[10003]!.capabilities.maxMsgValue).toBe(200000000000n);
    expect(enabledChains[10003]!.capabilities.requestPrefixes).toEqual([
      RequestPrefix.ERV1,
    ]);

    expect(enabledChains[10003]!.viemChain).toBeDefined();
    expect(enabledChains[10003]!.viemChain?.name).toBe("arbitrumSepolia");
    expect(enabledChains[10003]!.viemChain?.id).toBe(421614);
    expect(enabledChains[10003]!.viemChain?.nativeCurrency.name).toBe("Ether");
    expect(enabledChains[10003]!.viemChain?.nativeCurrency.symbol).toBe("ETH");
  });

  test("loads custom chains from custom path when CHAIN_CONFIG_PATH is set", async () => {
    const customPath = "/custom/path/chains.json";
    process.env.CHAIN_CONFIG_PATH = customPath;

    chainToChainId("ArbitrumSepolia");
    const mockCustomChainData = {
      "10003": {
        wormholeChainId: 10003,
        evmChainId: 1,
        rpc: "https://eth-mainnet.example.com",
        name: "Ethereum Mainnet",
        gasPriceDecimals: 18,
        nativeDecimals: 18,
        executorAddress: "0x1111111111111111111111111111111111111111",
        coreContractAddress: "0x2222222222222222222222222222222222222222",
        viemChainName: "mainnet",
        viemTokenName: "Ether",
        viemTokenSymbol: "ETH",
        capabilities: {
          requestPrefixes: ["ERV1"],
          gasDropOffLimit: "50000000000",
          maxGasLimit: "2000000",
          maxMsgValue: "100000000000",
        },
      },
    };

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(mockCustomChainData));

    delete require.cache[require.resolve("./chains")];
    const { enabledChains } = await import("./chains");

    expect(mockExistsSync).toHaveBeenCalledWith(customPath);
    expect(mockReadFileSync).toHaveBeenCalledWith(customPath, "utf-8");
    expect(enabledChains[10003]).toBeDefined();
    expect(enabledChains[10003]!.name).toBe("Ethereum Mainnet");
  });

  test("handles file reading errors gracefully", async () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("File read error");
    });

    delete require.cache[require.resolve("./chains")];
    const { enabledChains } = await import("./chains");

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load custom chains from",
      "/config/chains.json",
      expect.any(Error),
    );
  });

  test("handles invalid JSON in file gracefully", async () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("invalid json content");

    delete require.cache[require.resolve("./chains")];

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to load custom chains from",
      "/config/chains.json",
      expect.any(Error),
    );
  });
});
