import express from "express";
import cors from "cors";
import { overrideGuardianSet } from "./overrideGuardianSet";
import { quoteHandler, statusHandler, capabilitiesHandler } from "./api";
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
