import { describe, it, expect } from 'vitest';
import { MySQLAdapter } from '../src/adapters/mysql';
import { OracleAdapter } from '../src/adapters/oracle';
import { BaseAdapter } from '../src/adapters/base';

describe('Adapters', () => {
  describe('MySQLAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    it('should return error when not connected', async () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      const result = await adapter.query('SELECT 1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to database');
    });

    it('should have all required methods', () => {
      const adapter = new MySQLAdapter({
        host: 'localhost',
        port: 2881,
        user: 'root',
        password: 'password'
      });
      expect(adapter.connect).toBeDefined();
      expect(adapter.disconnect).toBeDefined();
      expect(adapter.query).toBeDefined();
      expect(adapter.listDatabases).toBeDefined();
      expect(adapter.listTables).toBeDefined();
      expect(adapter.describeTable).toBeDefined();
    });
  });

  describe('OracleAdapter', () => {
    it('should create adapter instance', () => {
      const adapter = new OracleAdapter({
        host: 'localhost',
        port: 2883,
        user: 'system',
        password: 'password',
        service: 'ORCL'
      });
      expect(adapter).toBeInstanceOf(BaseAdapter);
    });

    it('should return error when not connected', async () => {
      const adapter = new OracleAdapter({
        host: 'localhost',
        port: 2883,
        user: 'system',
        password: 'password',
        service: 'ORCL'
      });
      const result = await adapter.query('SELECT 1 FROM DUAL');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected to database');
    });

    it('should have all required methods', () => {
      const adapter = new OracleAdapter({
        host: 'localhost',
        port: 2883,
        user: 'system',
        password: 'password',
        service: 'ORCL'
      });
      expect(adapter.connect).toBeDefined();
      expect(adapter.disconnect).toBeDefined();
      expect(adapter.query).toBeDefined();
      expect(adapter.listDatabases).toBeDefined();
      expect(adapter.listTables).toBeDefined();
      expect(adapter.describeTable).toBeDefined();
    });
  });
});