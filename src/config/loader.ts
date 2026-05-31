import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { ConfigSchema, type ConfigSchemaType } from './schema.js';
import type { Config, SafetyConfig, OutputConfig, DatabaseMode } from '../types/index.js';
import { DEFAULT_SAFETY_CONFIG, DEFAULT_OUTPUT_CONFIG } from '../types/index.js';

export { ConfigSchema } from './schema.js';

/**
 * 命令行参数解析结果
 */
export interface CliArgs {
  configPath?: string;
  connection?: {
    mode?: DatabaseMode;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    service?: string;
  };
  safety?: {
    confirm_dangerous?: boolean;
    dangerous_keywords?: string[];
  };
  output?: {
    max_rows?: number;
  };
}

/**
 * 解析命令行参数
 *
 * 参数命名风格：--connection-host（连字符）
 */
export function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // 配置文件路径
    if (arg === '--config' || arg === '-c') {
      result.configPath = args[++i];
      continue;
    }

    // connection 配置
    if (arg === '--connection-mode') {
      result.connection = result.connection || {};
      result.connection.mode = args[++i] as DatabaseMode;
    } else if (arg === '--connection-host') {
      result.connection = result.connection || {};
      result.connection.host = args[++i];
    } else if (arg === '--connection-port') {
      result.connection = result.connection || {};
      result.connection.port = parseInt(args[++i], 10);
    } else if (arg === '--connection-user') {
      result.connection = result.connection || {};
      result.connection.user = args[++i];
    } else if (arg === '--connection-password') {
      result.connection = result.connection || {};
      result.connection.password = args[++i];
    } else if (arg === '--connection-database') {
      result.connection = result.connection || {};
      result.connection.database = args[++i];
    } else if (arg === '--connection-service') {
      result.connection = result.connection || {};
      result.connection.service = args[++i];
    }

    // safety 配置
    else if (arg === '--safety-confirm-dangerous') {
      result.safety = result.safety || {};
      result.safety.confirm_dangerous = args[++i] === 'true';
    } else if (arg === '--safety-dangerous-keywords') {
      result.safety = result.safety || {};
      result.safety.dangerous_keywords = args[++i].split(',').map(k => k.trim().toUpperCase());
    }

    // output 配置
    else if (arg === '--output-max-rows') {
      result.output = result.output || {};
      result.output.max_rows = parseInt(args[++i], 10);
    }
  }

  return result;
}

/**
 * 解析环境变量
 *
 * 环境变量命名风格：CONNECTION_HOST（下划线大写）
 */
export function parseEnvVars(): CliArgs {
  const result: CliArgs = {};

  // connection 配置
  const mode = process.env.CONNECTION_MODE;
  const host = process.env.CONNECTION_HOST;
  const port = process.env.CONNECTION_PORT;
  const user = process.env.CONNECTION_USER;
  const password = process.env.CONNECTION_PASSWORD;
  const database = process.env.CONNECTION_DATABASE;
  const service = process.env.CONNECTION_SERVICE;

  if (mode || host || port || user || password || database || service) {
    result.connection = {};
    if (mode) result.connection.mode = mode as DatabaseMode;
    if (host) result.connection.host = host;
    if (port) result.connection.port = parseInt(port, 10);
    if (user) result.connection.user = user;
    if (password) result.connection.password = password;
    if (database) result.connection.database = database;
    if (service) result.connection.service = service;
  }

  // safety 配置
  const confirmDangerous = process.env.SAFETY_CONFIRM_DANGEROUS;
  const dangerousKeywords = process.env.SAFETY_DANGEROUS_KEYWORDS;

  if (confirmDangerous || dangerousKeywords) {
    result.safety = {};
    if (confirmDangerous) result.safety.confirm_dangerous = confirmDangerous === 'true';
    if (dangerousKeywords) result.safety.dangerous_keywords = dangerousKeywords.split(',').map(k => k.trim().toUpperCase());
  }

  // output 配置
  const maxRows = process.env.OUTPUT_MAX_ROWS;

  if (maxRows) {
    result.output = {};
    result.output.max_rows = parseInt(maxRows, 10);
  }

  return result;
}

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
export function loadConfigFile(configPath: string): Partial<Config> {
  const absolutePath = path.resolve(configPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Config file not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const rawConfig = yaml.load(content);

  return validateConfig(rawConfig);
}

/**
 * 合并配置（三层优先级）
 *
 * 优先级：命令行参数 > 环境变量 > 配置文件 > 默认值
 */
export function mergeConfig(
  cliArgs: CliArgs,
  envVars: CliArgs,
  fileConfig?: Partial<Config>
): Config {
  // 从默认配置开始
  const defaultConfig = getDefaultConfig();

  // 构建 connection 配置（逐层覆盖）
  const connection = {
    mode: cliArgs.connection?.mode ?? envVars.connection?.mode ?? fileConfig?.connection?.mode ?? defaultConfig.connection.mode,
    host: cliArgs.connection?.host ?? envVars.connection?.host ?? fileConfig?.connection?.host ?? defaultConfig.connection.host,
    port: cliArgs.connection?.port ?? envVars.connection?.port ?? fileConfig?.connection?.port ?? defaultConfig.connection.port,
    user: cliArgs.connection?.user ?? envVars.connection?.user ?? fileConfig?.connection?.user ?? defaultConfig.connection.user,
    password: cliArgs.connection?.password ?? envVars.connection?.password ?? fileConfig?.connection?.password ?? defaultConfig.connection.password,
    database: cliArgs.connection?.database ?? envVars.connection?.database ?? fileConfig?.connection?.database ?? defaultConfig.connection.database,
    service: cliArgs.connection?.service ?? envVars.connection?.service ?? fileConfig?.connection?.service ?? defaultConfig.connection.service,
  };

  // 构建 safety 配置
  const safety: SafetyConfig = {
    confirm_dangerous: cliArgs.safety?.confirm_dangerous ?? envVars.safety?.confirm_dangerous ?? fileConfig?.safety?.confirm_dangerous ?? DEFAULT_SAFETY_CONFIG.confirm_dangerous,
    dangerous_keywords: cliArgs.safety?.dangerous_keywords ?? envVars.safety?.dangerous_keywords ?? fileConfig?.safety?.dangerous_keywords ?? DEFAULT_SAFETY_CONFIG.dangerous_keywords,
  };

  // 构建 output 配置
  const output: OutputConfig = {
    max_rows: cliArgs.output?.max_rows ?? envVars.output?.max_rows ?? fileConfig?.output?.max_rows ?? DEFAULT_OUTPUT_CONFIG.max_rows,
  };

  // 验证最终配置
  return validateConfig({ connection, safety, output });
}

/**
 * 加载配置（整合三层配置源）
 */
export function loadConfig(): Config {
  const cliArgs = parseCliArgs();
  const envVars = parseEnvVars();

  // 如果指定了配置文件，加载它
  let fileConfig: Partial<Config> | undefined;
  if (cliArgs.configPath) {
    fileConfig = loadConfigFile(cliArgs.configPath);
  }

  return mergeConfig(cliArgs, envVars, fileConfig);
}