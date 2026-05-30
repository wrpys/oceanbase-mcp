import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ConfigSchema, type ConfigSchemaType } from './schema.js';
import type { Config, SafetyConfig, OutputConfig } from '../types/index.js';
import { DEFAULT_SAFETY_CONFIG, DEFAULT_OUTPUT_CONFIG } from '../types/index.js';

export { ConfigSchema } from './schema.js';

/**
 * 验证配置对象
 */
export function validateConfig(config: unknown): Config {
  const parsed = ConfigSchema.parse(config);
  return {
    connection: {
      mode: parsed.connection.mode,
      host: parsed.connection.host,
      port: parsed.connection.port,
      user: parsed.connection.user,
      password: parsed.connection.password,
      database: parsed.connection.database,
      service: parsed.connection.service
    },
    safety: parsed.safety ?? DEFAULT_SAFETY_CONFIG,
    output: parsed.output ?? DEFAULT_OUTPUT_CONFIG
  };
}

/**
 * 获取默认配置
 */
export function getDefaultConfig(): Config {
  return {
    connection: {
      mode: 'mysql',
      host: 'localhost',
      port: 2881,
      user: 'root',
      password: ''
    },
    safety: DEFAULT_SAFETY_CONFIG,
    output: DEFAULT_OUTPUT_CONFIG
  };
}

/**
 * 从文件加载配置
 */
export function loadConfig(configPath: string): Config {
  const absolutePath = path.resolve(configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rawConfig = yaml.load(content);

  return validateConfig(rawConfig);
}