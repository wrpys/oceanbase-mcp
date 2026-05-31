import { z } from 'zod';

/**
 * 数据库模式 Schema
 *
 * 连接协议模式（注意：这是协议模式，不是数据库内部兼容模式）
 * - mysql: 使用 MySQL 协议连接（mysql2 驱动），支持端口 2881 或 2883
 *   - 适用于 OceanBase MySQL 兼容模式
 *   - 也适用于 OceanBase Oracle 兼容模式通过 MySQL 协议端口（2883）访问
 *   - 推荐方式，无需安装额外依赖
 * - oracle: 使用原生 Oracle 协议连接（oracledb 驱动），仅支持端口 2881
 *   - 仅适用于 OceanBase Oracle 兼容模式
 *   - 需要安装 Oracle Instant Client
 *   - 需要配置 service 参数
 */
export const DatabaseModeSchema = z.enum(['mysql', 'oracle']);

/**
 * 数据库连接配置 Schema
 */
export const ConnectionConfigSchema = z.object({
  mode: DatabaseModeSchema,
  host: z.string().min(1, 'host is required'),
  port: z.number().int().positive('port must be a positive integer'),
  user: z.string().min(1, 'user is required'),
  password: z.string(),
  database: z.string().optional(),
  service: z.string().optional()
});

/**
 * 安全配置 Schema
 */
export const SafetyConfigSchema = z.object({
  confirm_dangerous: z.boolean().default(true),
  dangerous_keywords: z.array(z.string()).default(['DROP', 'TRUNCATE', 'ALTER', 'DELETE'])
});

/**
 * 输出配置 Schema
 */
export const OutputConfigSchema = z.object({
  max_rows: z.number().int().min(0).default(100)
});

/**
 * 完整配置 Schema
 */
export const ConfigSchema = z.object({
  connection: ConnectionConfigSchema,
  safety: SafetyConfigSchema.optional(),
  output: OutputConfigSchema.optional()
});

export type ConfigSchemaType = z.infer<typeof ConfigSchema>;