import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
export declare function initDb(): Promise<void>;
export declare function getDb(): Database<sqlite3.Database, sqlite3.Statement>;
