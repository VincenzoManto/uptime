"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.getDb = getDb;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
let db;
async function initDb() {
    db = await (0, sqlite_1.open)({
        filename: './errors.db',
        driver: sqlite3_1.default.Database
    });
    await db.run(`
    CREATE TABLE IF NOT EXISTS errors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      message TEXT,
      stack TEXT,
        endpoint TEXT,
        type TEXT DEFAULT 'error'
    )
  `);
    await db.run(`
    CREATE TABLE IF NOT EXISTS uptime (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT,
      up_seconds INTEGER DEFAULT 0,
        latency INTEGER DEFAULT 0,
        endpoint_id TEXT
    )
  `);
}
function getDb() {
    if (!db)
        throw new Error('DB not initialized');
    return db;
}
