import express from "express";
import cors from "cors";
import { overrideGuardianSet } from "./overrideGuardianSet";
import {quoteHandler, statusHandler, capabilitiesHandler, vaasHandler} from "./api";
import { enabledChains } from "./chains";
import { isHex } from "viem";

// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString();
};

for (const chain of Object.values(enabledChains)) {
  if (!isHex(chain.coreContractAddress)) {
    throw new Error(`Invalid hex address for wormhole core contract`);
  }

  await overrideGuardianSet(chain.rpc, chain.coreContractAddress);
}

const app = express();

app.use(cors());
app.use(express.json());
app.post("/v0/quote", quoteHandler);
app.post("/v0/status/tx", statusHandler);
app.get("/v0/capabilities", capabilitiesHandler);
// This endpoint is part of the Wormholescan API and isn't part of the executor API, but is useful for exposing signed
// VAAs for clients who wish to not use the Executor for relaying and prefer to relay messages themselves.
app.get("/api/v1/vaas", vaasHandler);

const server = app.listen(3000, () => {
  console.log(`Server is running at http://localhost:3000`);
});

// Cleanup when the server is closing
const shutdown = async () => {
  console.log("Shutting down servers...");
  server.close(async () => {
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
