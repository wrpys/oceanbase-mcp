import { describe, it, expect } from 'vitest';
import { formatAsMarkdownTable, truncateRows } from '../src/formatter/markdown';

describe('Markdown Formatter', () => {
  describe('formatAsMarkdownTable', () => {
    it('should format simple data as markdown table', () => {
      const columns = ['id', 'name'];
      const data = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('| id | name |');
      expect(result).toContain('| --- | --- |');
      expect(result).toContain('| 1 | Alice |');
      expect(result).toContain('| 2 | Bob |');
    });

    it('should handle empty data', () => {
      const columns = ['id', 'name'];
      const data: unknown[] = [];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('| id | name |');
      expect(result).toContain('| --- | --- |');
    });

    it('should handle null and undefined values', () => {
      const columns = ['id', 'value'];
      const data = [
        { id: 1, value: null },
        { id: 2, value: undefined }
      ];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('| 1 | NULL |');
      expect(result).toContain('| 2 | NULL |');
    });

    it('should handle special characters', () => {
      const columns = ['text'];
      const data = [
        { text: 'Hello | World' }
      ];
      const result = formatAsMarkdownTable(columns, data);
      expect(result).toContain('Hello \\| World');
    });
  });

  describe('truncateRows', () => {
    it('should truncate rows when exceeding limit', () => {
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];
      const result = truncateRows(data, 2);
      expect(result.data.length).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.totalRows).toBe(3);
    });

    it('should not truncate when within limit', () => {
      const data = [
        { id: 1 },
        { id: 2 }
      ];
      const result = truncateRows(data, 5);
      expect(result.data.length).toBe(2);
      expect(result.truncated).toBe(false);
      expect(result.totalRows).toBe(2);
    });

    it('should handle zero limit (no truncation)', () => {
      const data = [
        { id: 1 },
        { id: 2 },
        { id: 3 }
      ];
      const result = truncateRows(data, 0);
      expect(result.data.length).toBe(3);
      expect(result.truncated).toBe(false);
    });
  });
});
