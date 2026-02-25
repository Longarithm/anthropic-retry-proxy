import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";
const PORT = parseInt(process.env.PORT || "3980");
const TARGET = "api.anthropic.com";
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || "3");
const BASE_DELAY = parseInt(process.env.BASE_DELAY || "1000");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = () => new Date().toISOString();
let reqCounter = 0;

function log(msg) {
  console.log(`${ts()} ${msg}`);
}

function forwardRequest(headers, body) {
  return new Promise((resolve, reject) => {
    const path = headers[":path"] || "/v1/messages";
    const fwdHeaders = Object.fromEntries(
      Object.entries({ ...headers, host: TARGET }).filter(([k]) => !k.startsWith(":"))
    );
    fwdHeaders["content-length"] = Buffer.byteLength(body);

    const req = httpsRequest(
      {
        hostname: TARGET,
        port: 443,
        path,
        method: "POST",
        headers: fwdHeaders,
      },
      (res) => resolve(res)
    );
    req.on("error", reject);
    req.end(body);
  });
}

const server = createServer(async (req, res) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Collect request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  const id = ++reqCounter;
  const path = req.url;
  const model = (() => { try { return JSON.parse(body).model } catch { return "?" } })();
  log(`[#${id}] ${req.method} ${path} model=${model}`);

  const fwdHeaders = Object.fromEntries(
    Object.entries(req.headers).filter(([k]) => !k.startsWith(":"))
  );
  fwdHeaders[":path"] = path;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const t0 = Date.now();
      const upstream = await forwardRequest(fwdHeaders, body);
      const elapsed = Date.now() - t0;

      if (upstream.statusCode >= 500 && attempt < MAX_RETRIES - 1) {
        // Drain the response body before retrying
        let errBody = "";
        for await (const c of upstream) errBody += c;
        const delay = BASE_DELAY * Math.pow(2, attempt);
        log(
          `[#${id}] RETRY ${upstream.statusCode} attempt ${attempt + 1}/${MAX_RETRIES} (${elapsed}ms), waiting ${delay}ms — ${errBody.slice(0, 200)}`
        );
        await sleep(delay);
        continue;
      }

      // Forward response as-is (success or final failure)
      log(`[#${id}] ${upstream.statusCode} (${elapsed}ms) attempt ${attempt + 1}/${MAX_RETRIES}`);
      res.writeHead(upstream.statusCode, upstream.headers);
      upstream.pipe(res);
      return;
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        log(
          `[#${id}] ERR attempt ${attempt + 1}/${MAX_RETRIES}: ${err.message}, waiting ${delay}ms`
        );
        await sleep(delay);
        continue;
      }
      log(`[#${id}] FAIL all ${MAX_RETRIES} attempts: ${err.message}`);
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }
});

server.listen(PORT, "127.0.0.1", () => {
  log(`Anthropic retry proxy listening on http://127.0.0.1:${PORT}`);
  log(`  -> https://${TARGET}`);
  log(`  Max retries: ${MAX_RETRIES}, base delay: ${BASE_DELAY}ms`);
});
