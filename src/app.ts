import cors from "cors";
import express from "express";

import { healthRouter } from "./inbound/routers/health.router.js";

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/health", healthRouter);

  return app;
};
