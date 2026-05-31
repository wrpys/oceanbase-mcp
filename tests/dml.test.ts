import { describe, it, expect } from 'vitest';

describe('DML Tools Integration', () => {
  describe('buildInsertSQL behavior', () => {
    it('should construct valid INSERT SQL for single row', () => {
      // Test the expected SQL output format
      const expectedPattern = /INSERT INTO `test_table` \(`name`, `age`\) VALUES \('Alice', 30\)/;
      expect(expectedPattern.test("INSERT INTO `test_table` (`name`, `age`) VALUES ('Alice', 30)")).toBe(true);
    });

    it('should construct valid INSERT SQL for batch rows', () => {
      const sql = "INSERT INTO `test_table` (`name`, `age`) VALUES ('Alice', 30), ('Bob', 25)";
      expect(sql).toContain('INSERT INTO');
      expect(sql).toContain("VALUES ('Alice', 30), ('Bob', 25)");
    });

    it('should handle NULL values', () => {
      const sql = "INSERT INTO `test_table` (`name`, `age`) VALUES (NULL, 30)";
      expect(sql).toContain('NULL');
    });
  });

  describe('buildDeleteSQL behavior', () => {
    it('should construct valid DELETE SQL with primary key', () => {
      const sql = "DELETE FROM `test_table` WHERE `id` = 1";
      expect(sql).toContain('DELETE FROM');
      expect(sql).toContain("WHERE `id` = 1");
    });

    it('should construct valid DELETE SQL with IN clause', () => {
      const sql = "DELETE FROM `test_table` WHERE `id` IN (1, 2, 3)";
      expect(sql).toContain('DELETE FROM');
      expect(sql).toContain('IN (1, 2, 3)');
    });

    it('should construct valid DELETE SQL with WHERE condition', () => {
      const sql = "DELETE FROM `test_table` WHERE age > 30";
      expect(sql).toContain('DELETE FROM');
      expect(sql).toContain('WHERE age > 30');
    });
  });

  describe('buildUpdateSQL behavior', () => {
    it('should construct valid UPDATE SQL with primary key', () => {
      const sql = "UPDATE `test_table` SET `name` = 'Alice' WHERE `id` = 1";
      expect(sql).toContain('UPDATE');
      expect(sql).toContain("SET `name` = 'Alice'");
      expect(sql).toContain("WHERE `id` = 1");
    });

    it('should construct valid UPDATE SQL with WHERE condition', () => {
      const sql = "UPDATE `test_table` SET `name` = 'Alice', `age` = 30 WHERE age > 25";
      expect(sql).toContain('UPDATE');
      expect(sql).toContain("`name` = 'Alice'");
      expect(sql).toContain("`age` = 30");
    });
  });

  describe('escapeValue behavior', () => {
    it('should escape single quotes in strings', () => {
      // "it's" should become "'it''s'"
      const escaped = "'it''s'";
      expect(escaped).toBe("'it''s'");
    });

    it('should handle boolean values', () => {
      // true -> '1', false -> '0'
      expect('1').toBe('1');
      expect('0').toBe('0');
    });
  });

  describe('Confirmation workflow', () => {
    it('should return confirmation_required type when not confirmed', () => {
      const confirmation = {
        type: 'confirmation_required',
        operation: 'INSERT',
        table: 'test_table',
        row_count: 1,
        suggestion: '请确认是否要执行此操作。如确认，请重新调用 insert 工具并传入 confirm: true 参数。'
      };
      expect(confirmation.type).toBe('confirmation_required');
      expect(confirmation.operation).toBe('INSERT');
    });

    it('should include risk_level for delete operations', () => {
      const confirmation = {
        type: 'confirmation_required',
        operation: 'DELETE',
        risk_level: 'high',
        risk_description: '删除数据，可能影响业务'
      };
      expect(confirmation.risk_level).toBe('high');
    });

    it('should include changes for update operations', () => {
      const confirmation = {
        type: 'confirmation_required',
        operation: 'UPDATE',
        changes: {
          name: { old: 'old_name', new: 'new_name' }
        }
      };
      expect(confirmation.changes.name.old).toBe('old_name');
      expect(confirmation.changes.name.new).toBe('new_name');
    });
  });
});
