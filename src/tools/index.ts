import type { DatabaseAdapter, SafetyConfig, OutputConfig } from '../types/index.js';
import { createQueryTool } from './query.js';
import { createListDatabasesTool } from './listDatabases.js';
import { createListTablesTool } from './listTables.js';
import { createDescribeTableTool } from './describeTable.js';

/**
 * 创建所有工具
 */
export function createTools(
  adapter: DatabaseAdapter,
  safetyConfig: SafetyConfig,
  outputConfig: OutputConfig
) {
  return [
    createQueryTool(adapter, safetyConfig, outputConfig),
    createListDatabasesTool(adapter),
    createListTablesTool(adapter),
    createDescribeTableTool(adapter)
  ];
}

export { createQueryTool } from './query.js';
export { createListDatabasesTool } from './listDatabases.js';
export { createListTablesTool } from './listTables.js';
export { createDescribeTableTool } from './describeTable.js';
