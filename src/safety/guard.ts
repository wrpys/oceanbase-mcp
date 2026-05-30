import type { SafetyConfig, ConfirmationRequired } from '../types/index.js';
import { DANGEROUS_KEYWORDS, getRiskLevel, getRiskDescription } from './keywords.js';

export { DANGEROUS_KEYWORDS } from './keywords.js';

/**
 * SQL 关键词风险级别映射（用于测试）
 */
export const RISK_LEVELS: Record<string, 'critical' | 'high' | 'medium'> = {
  DROP: 'critical',
  TRUNCATE: 'critical',
  ALTER: 'high',
  DELETE: 'high',
  UPDATE: 'medium',
  INSERT: 'medium'
};

/**
 * 安全检查结果
 */
export interface SafetyCheckResult {
  safe: boolean;
  confirmation?: ConfirmationRequired;
}

/**
 * 安全检查器
 */
export class SafetyGuard {
  private config: SafetyConfig;
  private keywordPattern: RegExp;

  constructor(config: SafetyConfig) {
    this.config = config;
    // 构建关键词正则表达式（用于检测危险 SQL）
    const keywords = config.dangerous_keywords.map(k => k.toUpperCase());
    this.keywordPattern = new RegExp(
      `\\b(${keywords.join('|')})\\b`,
      'i' // 不区分大小写
    );
  }

  /**
   * 检查 SQL 是否安全
   */
  check(sql: string): SafetyCheckResult {
    // 如果未启用危险操作确认，直接返回安全
    if (!this.config.confirm_dangerous) {
      return { safe: true };
    }

    // 查找匹配的危险关键词
    const match = sql.match(this.keywordPattern);

    if (!match) {
      return { safe: true };
    }

    const keyword = match[1].toUpperCase();
    const riskLevel = getRiskLevel(keyword) || 'medium';
    const riskDescription = getRiskDescription(keyword) || '可能存在风险的操作';

    return {
      safe: false,
      confirmation: {
        type: 'confirmation_required',
        sql,
        risk_level: riskLevel,
        risk_description: `此操作包含 ${keyword} 命令：${riskDescription}，请谨慎操作。`,
        suggestion: '请确认是否要执行此操作。如确认，请重新调用 query 工具并传入 confirm: true 参数。'
      }
    };
  }
}