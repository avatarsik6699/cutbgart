import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const manifest = await readFile("/app/release/models.manifest.json");
const modelConfig = Buffer.from('{\n  "model_type": "isnet"\n}');

const identityHeaders = {
  "X-Cutbg-Build-Id": process.env.APP_BUILD_ID,
  "X-Cutbg-Commit": process.env.APP_COMMIT_SHA,
  "X-Cutbg-Image-Digest": process.env.APP_IMAGE_DIGEST,
  "X-Cutbg-Created-At": process.env.APP_CREATED_AT,
};

createServer((request, response) => {
  const path = request.url ?? "/";
  if (process.env.FAIL_MODE === "1" && path === "/") {
    response.writeHead(500).end("forced candidate failure");
    return;
  }
  if (path.endsWith("/config.json") && path.includes("/models/")) {
    if (request.headers.range) {
      response
        .writeHead(206, {
          ...identityHeaders,
          "Content-Range": `bytes 0-0/${String(modelConfig.byteLength)}`,
          "Content-Length": "1",
        })
        .end(modelConfig.subarray(0, 1));
      return;
    }
    response.writeHead(200, identityHeaders).end(modelConfig);
    return;
  }
  if (path === "/models.manifest.json") {
    response
      .writeHead(200, { ...identityHeaders, "Content-Type": "application/json" })
      .end(manifest);
    return;
  }
  if (path === "/robots.txt") {
    response.writeHead(200, identityHeaders).end("User-agent: *\nAllow: /\n");
    return;
  }
  if (path === "/.well-known/security.txt") {
    response
      .writeHead(200, identityHeaders)
      .end("Contact: https://example.invalid/security\n");
    return;
  }
  if (["/", "/en", "/privacy", "/en/privacy"].includes(path)) {
    const language = path.startsWith("/en") ? "en" : "ru";
    response
      .writeHead(200, { ...identityHeaders, "Content-Type": "text/html" })
      .end(
        `<html lang="${language}"><main data-testid="home-page">cutbg Remove Background</main></html>`,
      );
    return;
  }
  response.writeHead(404, identityHeaders).end("not found");
}).listen(3000, "0.0.0.0");
