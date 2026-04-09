/* ============================================
   logger.js — Log estruturado simples

   - Console colorido em dev
   - Arquivo diário em logs/YYYY-MM-DD.log
   - Rotação automática por data
   ============================================ */

const fs = require("fs");
const path = require("path");
const config = require("./config");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LEVEL = LEVELS[process.env.LOG_LEVEL || (config.IS_PROD ? "info" : "debug")];

function getLogFilePath() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(config.LOG_DIR, `${date}.log`);
}

function writeToFile(line) {
  try {
    fs.appendFileSync(getLogFilePath(), line + "\n", "utf8");
  } catch (err) {
    // não deixa erro de log quebrar a app
  }
}

function redact(obj) {
  // Remove campos sensíveis antes de logar
  if (!obj || typeof obj !== "object") return obj;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  const sensitiveKeys = [
    "partner_key",
    "access_token",
    "refresh_token",
    "authorization",
    "x-cz-token",
    "password",
    "secret",
  ];
  for (const k of Object.keys(clone)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      clone[k] = "***REDACTED***";
    } else if (typeof clone[k] === "object") {
      clone[k] = redact(clone[k]);
    }
  }
  return clone;
}

function format(level, msg, meta) {
  const ts = new Date().toISOString();
  const payload = meta ? " " + JSON.stringify(redact(meta)) : "";
  return `[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}${payload}`;
}

function log(level, msg, meta) {
  if (LEVELS[level] > LEVEL) return;
  const line = format(level, msg, meta);
  writeToFile(line);

  const colorize = {
    error: "\x1b[31m", // vermelho
    warn: "\x1b[33m",  // amarelo
    info: "\x1b[36m",  // ciano
    debug: "\x1b[90m", // cinza
  };
  const reset = "\x1b[0m";
  const color = colorize[level] || "";
  // eslint-disable-next-line no-console
  console.log(color + line + reset);
}

module.exports = {
  error: (msg, meta) => log("error", msg, meta),
  warn: (msg, meta) => log("warn", msg, meta),
  info: (msg, meta) => log("info", msg, meta),
  debug: (msg, meta) => log("debug", msg, meta),
};
