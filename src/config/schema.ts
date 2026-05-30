import { z } from 'zod';

/**
 * 数据库模式 Schema
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