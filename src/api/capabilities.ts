import { type Request, type Response } from "express";
import { enabledChains } from "../chains";

export const capabilitiesHandler = async (req: Request, res: Response) => {
  const capabilities: Record<string, any> = {};

  for (const [_, chainConfig] of Object.entries(enabledChains)) {
    capabilities[chainConfig.wormholeChainId.toString()] = {
      requestPrefixes: chainConfig.capabilities.requestPrefixes,
      gasDropOffLimit: chainConfig.capabilities.gasDropOffLimit.toString(),
      maxGasLimit: chainConfig.capabilities.maxGasLimit.toString(),
      maxMsgValue: chainConfig.capabilities.maxMsgValue.toString(),
    };
  }

  res.json(capabilities);
};
