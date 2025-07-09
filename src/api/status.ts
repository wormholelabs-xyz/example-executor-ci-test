import { type Request, type Response } from "express";

export const statusHandler = async (req: Request, res: Response) => {
  res.status(500).send();
};
