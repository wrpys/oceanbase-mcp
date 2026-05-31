import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigSchema, validateConfig, loadConfig, getDefaultConfig, parseCliArgs, parseEnvVars, mergeConfig } from '../src/config/loader';
import type { Config, SafetyConfig, OutputConfig } from '../src/types';

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

  describe('parseCliArgs', () => {
    it('should parse connection parameters', () => {
      // 模拟命令行参数
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js',
        '--connection-host', 'localhost',
        '--connection-port', '2883',
        '--connection-user', 'root',
        '--connection-password', 'secret',
        '--connection-database', 'testdb',
        '--connection-mode', 'mysql'
      ];

      const result = parseCliArgs();

      expect(result.connection?.host).toBe('localhost');
      expect(result.connection?.port).toBe(2883);
      expect(result.connection?.user).toBe('root');
      expect(result.connection?.password).toBe('secret');
      expect(result.connection?.database).toBe('testdb');
      expect(result.connection?.mode).toBe('mysql');

      process.argv = originalArgv;
    });

    it('should parse safety and output parameters', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js',
        '--safety-confirm-dangerous', 'false',
        '--safety-dangerous-keywords', 'DROP,TRUNCATE',
        '--output-max-rows', '50'
      ];

      const result = parseCliArgs();

      expect(result.safety?.confirm_dangerous).toBe(false);
      expect(result.safety?.dangerous_keywords).toEqual(['DROP', 'TRUNCATE']);
      expect(result.output?.max_rows).toBe(50);

      process.argv = originalArgv;
    });

    it('should parse config path', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js', '--config', '/path/to/config.yaml'];

      const result = parseCliArgs();

      expect(result.configPath).toBe('/path/to/config.yaml');

      process.argv = originalArgv;
    });

    it('should return empty object when no args', () => {
      const originalArgv = process.argv;
      process.argv = ['node', 'script.js'];

      const result = parseCliArgs();

      expect(result.connection).toBeUndefined();
      expect(result.safety).toBeUndefined();
      expect(result.output).toBeUndefined();

      process.argv = originalArgv;
    });
  });

  describe('parseEnvVars', () => {
    it('should parse connection environment variables', () => {
      process.env.CONNECTION_HOST = 'db.example.com';
      process.env.CONNECTION_PORT = '3306';
      process.env.CONNECTION_USER = 'admin';
      process.env.CONNECTION_PASSWORD = 'pass123';
      process.env.CONNECTION_DATABASE = 'mydb';
      process.env.CONNECTION_MODE = 'mysql';

      const result = parseEnvVars();

      expect(result.connection?.host).toBe('db.example.com');
      expect(result.connection?.port).toBe(3306);
      expect(result.connection?.user).toBe('admin');
      expect(result.connection?.password).toBe('pass123');
      expect(result.connection?.database).toBe('mydb');
      expect(result.connection?.mode).toBe('mysql');

      // 清理环境变量
      delete process.env.CONNECTION_HOST;
      delete process.env.CONNECTION_PORT;
      delete process.env.CONNECTION_USER;
      delete process.env.CONNECTION_PASSWORD;
      delete process.env.CONNECTION_DATABASE;
      delete process.env.CONNECTION_MODE;
    });

    it('should parse safety and output environment variables', () => {
      process.env.SAFETY_CONFIRM_DANGEROUS = 'false';
      process.env.SAFETY_DANGEROUS_KEYWORDS = 'DROP,ALTER';
      process.env.OUTPUT_MAX_ROWS = '200';

      const result = parseEnvVars();

      expect(result.safety?.confirm_dangerous).toBe(false);
      expect(result.safety?.dangerous_keywords).toEqual(['DROP', 'ALTER']);
      expect(result.output?.max_rows).toBe(200);

      delete process.env.SAFETY_CONFIRM_DANGEROUS;
      delete process.env.SAFETY_DANGEROUS_KEYWORDS;
      delete process.env.OUTPUT_MAX_ROWS;
    });
  });

  describe('mergeConfig', () => {
    it('should use defaults when no config provided', () => {
      const result = mergeConfig({}, {});

      expect(result.connection.host).toBe('localhost');
      expect(result.connection.port).toBe(2881);
      expect(result.connection.mode).toBe('mysql');
      expect(result.safety.confirm_dangerous).toBe(true);
      expect(result.output.max_rows).toBe(100);
    });

    it('should prioritize CLI args over env vars', () => {
      const cliArgs = { connection: { host: 'cli-host', port: 3306 } };
      const envVars = { connection: { host: 'env-host', port: 5432 } };

      const result = mergeConfig(cliArgs, envVars);

      expect(result.connection.host).toBe('cli-host');
      expect(result.connection.port).toBe(3306);
    });

    it('should prioritize env vars over file config', () => {
      const envVars = { connection: { host: 'env-host' } };
      const fileConfig = { connection: { host: 'file-host', port: 2883 } };

      const result = mergeConfig({}, envVars, fileConfig);

      expect(result.connection.host).toBe('env-host');
      expect(result.connection.port).toBe(2883); // 从 fileConfig 继承
    });

    it('should merge all layers correctly', () => {
      const cliArgs = { connection: { host: 'cli-host' } };
      const envVars = { connection: { port: 3306, user: 'env-user' } };
      const fileConfig = { connection: { password: 'file-pass', database: 'file-db' } };

      const result = mergeConfig(cliArgs, envVars, fileConfig);

      expect(result.connection.host).toBe('cli-host');    // CLI
      expect(result.connection.port).toBe(3306);           // Env
      expect(result.connection.user).toBe('env-user');     // Env
      expect(result.connection.password).toBe('file-pass'); // File
      expect(result.connection.database).toBe('file-db');   // File
      expect(result.connection.mode).toBe('mysql');         // Default
    });
  });
});