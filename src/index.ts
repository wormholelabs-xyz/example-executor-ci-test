import express from "express";
import cors from "cors";
import { overrideGuardianSet } from "./overrideGuardianSet";
import { quoteHandler, statusHandler, capabilitiesHandler } from "./api";

// @ts-ignore
BigInt.prototype.toJSON = function () {
  // Can also be JSON.rawJSON(this.toString());
  return this.toString();
};

await overrideGuardianSet(
  "http://anvil-eth-sepolia:8545",
  "0x4a8bc80Ed5a4067f1CCf107057b8270E0cC11A78"
);
await overrideGuardianSet(
  "http://anvil-base-sepolia:8545",
  "0x79A1027a6A159502049F10906D333EC57E95F083"
);

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
