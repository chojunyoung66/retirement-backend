import dotenv from "dotenv";

dotenv.config();

// Verify DATABASE_URL is loaded before importing anything that uses Prisma
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("ERROR: DATABASE_URL is not set in environment");
  process.exit(1);
}

import { createApp } from "./bootstrap.js";

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
