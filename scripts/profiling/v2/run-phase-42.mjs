import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const verifier = path.join(directory, "verify-phase-42-reports.ts");
execFileSync("pnpm", ["exec", "tsx", verifier], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
