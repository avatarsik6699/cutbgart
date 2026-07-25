import { readFile } from "node:fs/promises";

const configPath = process.env.ALERT_CONFIG_PATH ?? "docs/operations/alerts.json";
const config = JSON.parse(await readFile(configPath, "utf8"));
const requiredSignals = new Set([
  "app-down",
  "cdn-model-failure",
  "certificate-expiry",
  "disk-resource-pressure",
  "backup-failure",
  "elevated-5xx",
]);
const forbiddenKeys = /image|filename|sourceUrl|prompt|mask|composite/i;

for (const alert of config.alerts ?? []) {
  requiredSignals.delete(alert.id);
  for (const field of [
    "severity",
    "owner",
    "escalation",
    "maintenanceSuppression",
    "deduplication",
    "runbook",
    "threshold",
  ]) {
    if (!alert[field]) throw new Error(`${alert.id}: missing ${field}`);
  }
  if (Object.keys(alert).some((key) => forbiddenKeys.test(key))) {
    throw new Error(`${alert.id}: prohibited alert field`);
  }
}
if (requiredSignals.size) {
  throw new Error(`Missing alerts: ${[...requiredSignals].join(",")}`);
}
console.log("[alerts] check=config result=pass");

const deliveryUrl = process.env.ALERT_DELIVERY_URL;
if (deliveryUrl) {
  for (const alert of config.alerts) {
    for (const state of ["firing", "resolved"]) {
      const response = await fetch(deliveryUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          signal: alert.id,
          state,
          severity: "test",
          runbook: alert.runbook,
        }),
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`Delivery ${alert.id}/${state} failed`);
      console.log(
        `[alerts] check=delivery signal=${alert.id} state=${state} result=pass`,
      );
    }
  }
}
