import { describe, it, expect, beforeAll } from 'vitest';
import { initDb, getDb } from '../src/db';
import { renderDashboard } from '../src/frontend';

describe('DB', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('should insert and retrieve an error', async () => {
    const db = getDb();
    await db.run('INSERT INTO errors (message, stack) VALUES (?, ?)', 'test error', 'stacktrace');
    const row = await db.get('SELECT * FROM errors WHERE message = ?', 'test error');
    expect(row).toBeDefined();
    expect(row.message).toBe('test error');
  });

  it('should insert and retrieve uptime', async () => {
    const db = getDb();
    await db.run('INSERT OR REPLACE INTO uptime (day, up_seconds) VALUES (?, ?)', '2024-01-01', 3600);
    const row = await db.get('SELECT * FROM uptime WHERE day = ?', '2024-01-01');
    expect(row).toBeDefined();
    expect(row.up_seconds).toBe(3600);
  });
});

describe('Frontend', () => {
  it('should render dashboard HTML', () => {
    const html = renderDashboard({
      incidents: [{ timestamp: '2024-01-01', message: 'err' }],
      uptimeRows: [{ day: '2024-01-01', up_seconds: 3600 }],
      avgUptime: 3600,
        endpoints: ['endpoint1', 'endpoint2']
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('API Status Dashboard');
    expect(html).toContain('err');
  });
});