/**
 * 危险关键词及其风险级别和描述
 */
export const DANGEROUS_KEYWORDS: Record<string, { level: 'critical' | 'high' | 'medium'; description: string }> = {
  DROP: {
    level: 'critical',
    description: '删除数据库/表，数据永久丢失'
  },
  TRUNCATE: {
    level: 'critical',
    description: '清空表数据，无法恢复'
  },
  ALTER: {
    level: 'high',
    description: '修改表结构，可能影响应用'
  },
  DELETE: {
    level: 'high',
    description: '删除数据，可能影响业务'
  },
  UPDATE: {
    level: 'medium',
    description: '更新数据，建议先备份'
  },
  INSERT: {
    level: 'medium',
    description: '插入数据，相对安全'
  }
};

/**
 * 获取关键词的风险级别
 */
export function getRiskLevel(keyword: string): 'critical' | 'high' | 'medium' | undefined {
  const upperKeyword = keyword.toUpperCase();
  return DANGEROUS_KEYWORDS[upperKeyword]?.level;
}

/**
 * 获取关键词的风险描述
 */
export function getRiskDescription(keyword: string): string | undefined {
  const upperKeyword = keyword.toUpperCase();
  return DANGEROUS_KEYWORDS[upperKeyword]?.description;
}