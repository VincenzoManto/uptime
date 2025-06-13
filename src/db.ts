import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

let db: Database;

export async function initDb() {
  db = await open({
    filename: './errors.db',
    driver: sqlite3.Database
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

export function getDb() {
  if (!db) throw new Error('DB not initialized');
  return db;
}