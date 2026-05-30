import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigSchema, validateConfig, loadConfig, getDefaultConfig } from '../src/config/loader';
import type { Config } from '../src/types';

describe('Config Loader', () => {
  describe('validateConfig', () => {
    it('should validate minimal MySQL config', () => {
      const config = {
        connection: {
          mode: 'mysql',
          host: 'localhost',
          port: 2881,
          user: 'root',
          password: 'password'
        }
      };
      const result = validateConfig(config);
      expect(result.connection.mode).toBe('mysql');
      expect(result.safety?.confirm_dangerous).toBe(true);
    });

    it('should validate Oracle config with service', () => {
      const config = {
        connection: {
          mode: 'oracle',
          host: 'localhost',
          port: 2883,
          user: 'system',
          password: 'password',
          service: 'ORCL'
        }
      };
      const result = validateConfig(config);
      expect(result.connection.mode).toBe('oracle');
      expect(result.connection.service).toBe('ORCL');
    });

    it('should reject invalid mode', () => {
      const config = {
        connection: {
          mode: 'invalid',
          host: 'localhost',
          port: 2881,
          user: 'root',
          password: 'password'
        }
      };
      expect(() => validateConfig(config)).toThrow();
    });

    it('should reject missing required fields', () => {
      const config = {
        connection: {
          mode: 'mysql'
        }
      };
      expect(() => validateConfig(config)).toThrow();
    });
  });

  describe('getDefaultConfig', () => {
    it('should return config with defaults', () => {
      const config = getDefaultConfig();
      expect(config.safety?.confirm_dangerous).toBe(true);
      expect(config.safety?.dangerous_keywords).toContain('DROP');
      expect(config.output?.max_rows).toBe(100);
    });
  });
});
