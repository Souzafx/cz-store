/* ============================================
   CZ Store — Frontend Static Server

   Servidor HTTP mínimo (zero dependências) que serve os arquivos
   estáticos do frontend em http://localhost:3030.

   Por que existir:
   - Abrir via file:// funciona, mas alguns navegadores têm restrições
     (CORS com proxies, Service Workers, etc)
   - Dá consistência com o backend Shopee (localhost:3000)
   - Primeiro passo rumo a um deploy online real
   - Zero npm install — usa só módulos nativos do Node

   Uso:
     node frontend-server.js
     → http://localhost:3030

   Para rodar em outra porta:
     PORT=4000 node frontend-server.js
   ============================================ */

const http = require("http");
const fs = require("fs");
const path = require("path");

// ==========================================================
// Config
// ==========================================================
const PORT = parseInt(process.env.PORT) || 3030;
const HOST = process.env.HOST || "127.0.0.1";
const ROOT = __dirname;

// Tipos MIME que o frontend precisa
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".mjs":  "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
};

// Pastas que NÃO devem ser servidas (segurança)
const BLOCKED_PATHS = [
  "/.git",
  "/.env",
  "/backend/.env",
  "/backend/node_modules",
  "/backend/data",
  "/backend/logs",
  "/node_modules",
];

// ==========================================================
// Helpers
// ==========================================================
function log(level, msg) {
  const ts = new Date().toISOString();
  const colors = { info: "\x1b[36m", warn: "\x1b[33m", err: "\x1b[31m" };
  const reset = "\x1b[0m";
  console.log(`${colors[level] || ""}[${ts}] ${level.toUpperCase()} ${msg}${reset}`);
}

function sendError(res, status, msg) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(msg);
}

// ==========================================================
// Request handler
// ==========================================================
const server = http.createServer((req, res) => {
  // Só aceita GET/HEAD
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendError(res, 405, "Method not allowed");
  }

  // Parse URL (remove query string e decoda)
  let reqPath;
  try {
    reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  } catch {
    return sendError(res, 400, "Bad URL");
  }

  // Bloqueia paths sensíveis
  if (BLOCKED_PATHS.some((blocked) => reqPath.startsWith(blocked))) {
    log("warn", `Bloqueado: ${reqPath}`);
    return sendError(res, 403, "Forbidden");
  }

  // Rota raiz → index.html
  if (reqPath === "/" || reqPath === "") reqPath = "/index.html";

  // Resolve caminho absoluto e verifica que está dentro do ROOT
  // (previne directory traversal tipo ?path=../../etc/passwd)
  const filePath = path.resolve(ROOT, "." + reqPath);
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    log("warn", `Traversal tentado: ${reqPath}`);
    return sendError(res, 403, "Forbidden");
  }

  // Lê stat do arquivo
  fs.stat(filePath, (err, stats) => {
    if (err) {
      log("warn", `404: ${reqPath}`);
      return sendError(res, 404, "Not Found");
    }

    // Se for diretório, tenta servir index.html dentro dele
    if (stats.isDirectory()) {
      const indexInside = path.join(filePath, "index.html");
      fs.stat(indexInside, (err2, stats2) => {
        if (err2 || !stats2.isFile()) {
          return sendError(res, 403, "Directory listing disabled");
        }
        serveFile(indexInside, stats2, req, res);
      });
      return;
    }

    if (!stats.isFile()) return sendError(res, 404, "Not Found");
    serveFile(filePath, stats, req, res);
  });
});

function serveFile(filePath, stats, req, res) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";

  // Headers de cache — desligado em dev para refletir mudanças imediatas
  const headers = {
    "Content-Type": mime,
    "Content-Length": stats.size,
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "X-Content-Type-Options": "nosniff",
  };

  res.writeHead(200, headers);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  // Stream do arquivo
  const stream = fs.createReadStream(filePath);
  stream.on("error", (err) => {
    log("err", `Erro lendo ${filePath}: ${err.message}`);
    if (!res.headersSent) sendError(res, 500, "Internal Server Error");
    else res.end();
  });
  stream.pipe(res);

  log("info", `200 ${req.method} ${req.url}`);
}

// ==========================================================
// Start
// ==========================================================
server.listen(PORT, HOST, () => {
  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("  CZ Store — Frontend Static Server");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  🌐 http://${HOST}:${PORT}`);
  console.log(`  📁 Servindo: ${ROOT}`);
  console.log(`  🛡️  Cache:    desligado (modo dev)`);
  console.log("");
  console.log("  💡 Dica: abra essa URL no Chrome e tudo funciona");
  console.log("     normalmente — inclusive a integração Shopee");
  console.log("     (basta o backend estar rodando em :3000)");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
});

// Graceful shutdown
function shutdown(signal) {
  log("info", `Recebido ${signal}, encerrando...`);
  server.close(() => {
    log("info", "Servidor fechado. Bye.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
