import { enabledChains } from "../chains.ts";
import { mockWormhole } from "../mockGuardian.ts";
import { type Request, type Response } from "express";
import { type Hex, isHex } from "viem";

export const vaasHandler = async (req: Request, res: Response) => {
  let txHash = req.query["txHash"];

  if (!txHash) {
    res.status(400).send("txHash is required.");
    return;
  }

  if (!isHex(txHash)) {
    res.status(400).send("txHash must be a valid hex string.");
    return;
  }

  // Loop through enabledChains and try mockWormhole for each one, returning the first signed VAA
  // that mockWormhole returns.
  for (const chainConfig of Object.values(enabledChains)) {
    try {
      if (!isHex(chainConfig.coreContractAddress)) {
        continue;
      }
      const result = await mockWormhole(
        chainConfig.rpc,
        txHash,
        chainConfig.coreContractAddress,
        "",
      );

      if (result !== undefined) {
        res.status(200).json({
            data: [{ emitterChain: chainConfig.wormholeChainId, vaa: result }]
        });
        return;
      }
    } catch (error) {
      // Continue to next chain if this one fails
      console.log(`Failed to get VAA from chain ${chainConfig.name}:`, error);
    }
  }

  res.status(200).json({
    data: [],
  });
};
