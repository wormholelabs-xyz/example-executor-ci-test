import express, { type Request, type Response } from "express";

const app = express();
app.use(express.json());
app.post("/v0/quote", async (req: Request, res: Response) => {
  res.status(500).send();
});
app.post("/v0/status/tx", async (req: Request, res: Response) => {
  res.status(500).send();
});
app.get("/v0/capabilities", async (req: Request, res: Response) => {
  res.status(500).send();
});
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
