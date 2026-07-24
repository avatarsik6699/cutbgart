import { execFileSync } from "node:child_process";

const allowedLicenses = new Set([
  "MIT",
  "OFL-1.1",
  "Apache-2.0",
  "LGPL-3.0-or-later",
  "BSD-3-Clause",
  "ISC",
  "Python-2.0",
  "CC-BY-4.0",
  "BSD-2-Clause",
  "Unlicense",
  "MPL-2.0",
  "(MIT OR CC0-1.0)",
]);

const raw = execFileSync("pnpm", ["licenses", "list", "--prod", "--json"], {
  encoding: "utf8",
});
const inventory = JSON.parse(raw) as Record<string, Array<{ name: string }>>;
const unreviewed = Object.keys(inventory).filter(
  (license) => !allowedLicenses.has(license),
);
if (unreviewed.length) {
  for (const license of unreviewed) {
    const packages = inventory[license]?.map(({ name }) => name).join(", ");
    console.error(`Unreviewed production license ${license}: ${packages}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Production license policy passed (${String(Object.keys(inventory).length)} reviewed expressions)`,
  );
}
