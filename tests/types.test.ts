import { describe, it, expect } from 'vitest';
import type { Config, ConnectionConfig, SafetyConfig, OutputConfig, QueryResult, ConfirmationRequired } from '../src/types';

describe('Types', () => {
  it('should accept valid MySQL connection config', () => {
    const conn: ConnectionConfig = {
      mode: 'mysql',
      host: 'localhost',
      port: 2881,
      user: 'root',
      password: 'password',
      database: 'test'
    };
    expect(conn.mode).toBe('mysql');
  });

  it('should accept valid Oracle connection config', () => {
    const conn: ConnectionConfig = {
      mode: 'oracle',
      host: 'localhost',
      port: 2883,
      user: 'system',
      password: 'password',
      service: 'ORCL'
    };
    expect(conn.mode).toBe('oracle');
  });

  it('should accept valid full config', () => {
    const config: Config = {
      connection: {
        mode: 'mysql',
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      },
      safety: {
        confirm_dangerous: true,
        dangerous_keywords: ['DROP', 'TRUNCATE']
      },
      output: {
        max_rows: 100
      }
    };
    expect(config.connection.mode).toBe('mysql');
  });
});
