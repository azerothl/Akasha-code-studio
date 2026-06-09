#!/usr/bin/env node
/**
 * Serve Akasha Code Studio (dist/) on 127.0.0.1 with /api proxy to the daemon.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(__dirname, "..", "dist");
const HOST = process.env.HOST ?? process.env.AKASHA_STUDIO_HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? process.env.AKASHA_STUDIO_PORT ?? 5178);
const DAEMON_URL = (process.env.VITE_DAEMON_URL ?? process.env.CODE_STUDIO_DAEMON_URL ?? "http://127.0.0.1:3876").replace(/\/$/, "");

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff2", "font/woff2"],
  [".webp", "image/webp"],
  [".map", "application/json"],
]);

function mimeFor(file) {
  return MIME.get(path.extname(file).toLowerCase()) ?? "application/octet-stream";
}

function proxyApi(req, res) {
  const u = new URL(req.url ?? "/", `http://${HOST}`);
  const target = new URL(u.pathname.replace(/^\/api/, "/api") + u.search, DAEMON_URL);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  const proxyReq = http.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      res.end(`daemon proxy (${DAEMON_URL}): ${err.message}`);
    }
  });
  req.pipe(proxyReq);
}

function serveDist(req, res) {
  const u = new URL(req.url ?? "/", `http://${HOST}`);
  let rel = u.pathname === "/" ? "index.html" : u.pathname.slice(1);
  if (!rel || rel.includes("..")) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  const resolvedDist = path.resolve(dist);
  const full = path.resolve(resolvedDist, rel);
  const relToDist = path.relative(resolvedDist, full);
  if (relToDist.startsWith("..") || path.isAbsolute(relToDist)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(full, (err, data) => {
    if (!err) {
      res.writeHead(200, { "content-type": mimeFor(full) });
      res.end(data);
      return;
    }
    fs.readFile(path.join(dist, "index.html"), (err2, html) => {
      if (err2) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
    });
  });
}

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("[akasha-code-studio] missing dist/index.html — run: npm run build");
  process.exit(1);
}

http
  .createServer((req, res) => {
    const url = req.url ?? "/";
    if (url.startsWith("/api")) {
      proxyApi(req, res);
      return;
    }
    serveDist(req, res);
  })
  .listen(PORT, HOST, () => {
    console.log(`Akasha Code Studio → http://${HOST}:${PORT}/ (API → ${DAEMON_URL})`);
  });
