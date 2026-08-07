import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const phase33ImageCorpus = {
  smoke: {
    path: path.join(e2eDirectory, "fixtures/sample.jpg"),
    width: 1,
    height: 1,
    purpose: "fast protocol and UI lifecycle coverage",
  },
  representative: {
    path: path.resolve(e2eDirectory, "../public/og-image.png"),
    width: 1536,
    height: 1024,
    purpose: "real decode, inference, responsiveness, and target-device evidence",
  },
} as const;
