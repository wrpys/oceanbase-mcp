import { describe, it, expect } from 'vitest';
import { SafetyGuard, RISK_LEVELS } from '../src/safety/guard';
import type { SafetyConfig } from '../src/types';

describe('Safety Guard', () => {
  const defaultConfig: SafetyConfig = {
    confirm_dangerous: true,
    dangerous_keywords: ['DROP', 'TRUNCATE', 'ALTER', 'DELETE']
  };

  describe('RISK_LEVELS', () => {
    it('should have correct risk levels', () => {
      expect(RISK_LEVELS['DROP']).toBe('critical');
      expect(RISK_LEVELS['TRUNCATE']).toBe('critical');
      expect(RISK_LEVELS['ALTER']).toBe('high');
      expect(RISK_LEVELS['DELETE']).toBe('high');
      expect(RISK_LEVELS['UPDATE']).toBe('medium');
      expect(RISK_LEVELS['INSERT']).toBe('medium');
    });
  });

  describe('SafetyGuard', () => {
    it('should detect DROP as dangerous', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('DROP TABLE users;');
      expect(result.safe).toBe(false);
      expect(result.confirmation?.risk_level).toBe('critical');
    });

    it('should detect TRUNCATE as dangerous', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('TRUNCATE TABLE users;');
      expect(result.safe).toBe(false);
      expect(result.confirmation?.risk_level).toBe('critical');
    });

    it('should detect DELETE as dangerous', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('DELETE FROM users WHERE id = 1;');
      expect(result.safe).toBe(false);
      expect(result.confirmation?.risk_level).toBe('high');
    });

    it('should allow SELECT queries', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('SELECT * FROM users;');
      expect(result.safe).toBe(true);
      expect(result.confirmation).toBeUndefined();
    });

    it('should allow INSERT when not in dangerous_keywords', () => {
      const config: SafetyConfig = {
        confirm_dangerous: true,
        dangerous_keywords: ['DROP', 'TRUNCATE', 'ALTER', 'DELETE']
      };
      const guard = new SafetyGuard(config);
      const result = guard.check('INSERT INTO users VALUES (1, "test");');
      expect(result.safe).toBe(true);
    });

    it('should allow all when confirm_dangerous is false', () => {
      const config: SafetyConfig = {
        confirm_dangerous: false,
        dangerous_keywords: ['DROP']
      };
      const guard = new SafetyGuard(config);
      const result = guard.check('DROP TABLE users;');
      expect(result.safe).toBe(true);
    });

    it('should detect case-insensitive keywords', () => {
      const guard = new SafetyGuard(defaultConfig);
      const result = guard.check('drop table users;');
      expect(result.safe).toBe(false);
    });
  });
});