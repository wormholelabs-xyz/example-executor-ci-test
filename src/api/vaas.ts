import { enabledChains } from "../chains.ts";
import { mockWormhole } from "../mockGuardian.ts";
import { type Request, type Response } from "express";
import type { Hex } from "viem";

export const vaasHandler = async (req: Request, res: Response) => {
  let txHash = req.query["txHash"];

  if (!txHash) {
    res.status(400).send("txHash is required.");
    return;
  }

  // Loop through enabledChains and try mockWormhole for each one, returning the first signed VAA
  // that mockWormhole returns.
  for (const chainConfig of Object.values(enabledChains)) {
    try {
      const result = await mockWormhole(
        chainConfig.rpc,
        txHash as Hex,
        chainConfig.coreContractAddress as Hex,
        "",
      );

      if (result !== undefined) {
        res.status(200).json({ data: [{ vaa: result }] });
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
