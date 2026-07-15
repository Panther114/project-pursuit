/**
 * Lightweight production static server for Railway.
 * No Express/Vite/preview — plain Node http only (low RAM/CPU).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8"
};

function safeJoin(root, requestPath) {
  const decoded = decodeURIComponent(requestPath.split("?")[0] || "/");
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const resolved = path.join(root, normalized);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Cache-Control": status === 200 ? headers["Cache-Control"] || "public, max-age=0" : "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  });
  res.end(body);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = TYPES[ext] || "application/octet-stream";
  const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`);
  const cache = isHashedAsset
    ? "public, max-age=31536000, immutable"
    : ext === ".html"
      ? "public, max-age=0, must-revalidate"
      : "public, max-age=3600";

  const stream = fs.createReadStream(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff"
  });
  stream.on("error", () => {
    if (!res.headersSent) send(res, 500, "Internal Server Error");
    else res.destroy();
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed");
    return;
  }

  // Cheap liveness endpoint for Railway healthchecks (no disk work beyond this).
  if (req.url === "/healthz" || req.url === "/health") {
    send(res, 200, "ok", { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    return;
  }

  let target = safeJoin(ROOT, req.url || "/");
  if (!target) {
    send(res, 400, "Bad Request");
    return;
  }

  fs.stat(target, (err, stat) => {
    if (!err && stat.isDirectory()) {
      target = path.join(target, "index.html");
    }

    fs.stat(target, (fileErr, fileStat) => {
      if (!fileErr && fileStat.isFile()) {
        if (req.method === "HEAD") {
          send(res, 200, "", {
            "Content-Type": TYPES[path.extname(target).toLowerCase()] || "application/octet-stream",
            "Cache-Control": "public, max-age=0"
          });
          return;
        }
        sendFile(res, target);
        return;
      }

      // SPA fallback for client routes (/competitions, /programs, /dreams)
      const indexPath = path.join(ROOT, "index.html");
      fs.stat(indexPath, (indexErr) => {
        if (indexErr) {
          send(res, 404, "Not Found");
          return;
        }
        if (req.method === "HEAD") {
          send(res, 200, "", { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, must-revalidate" });
          return;
        }
        sendFile(res, indexPath);
      });
    });
  });
});

// Keep the event loop lean: short timeouts, few sockets.
server.requestTimeout = 30_000;
server.headersTimeout = 35_000;
server.keepAliveTimeout = 5_000;
server.maxHeadersCount = 50;

server.listen(PORT, HOST, () => {
  // Single log line — avoid chatty logging in production.
  console.log(`project-pursuit static server on http://${HOST}:${PORT}`);
});
