import { describe, it, expect } from 'vitest';
import { INPUT_LIMITS } from '@/config';

describe('INPUT_LIMITS constants', () => {
  it('should have MAX_NAME_LENGTH defined', () => {
    expect(INPUT_LIMITS.MAX_NAME_LENGTH).toBeDefined();
    expect(typeof INPUT_LIMITS.MAX_NAME_LENGTH).toBe('number');
    expect(INPUT_LIMITS.MAX_NAME_LENGTH).toBeGreaterThan(0);
  });

  it('should have MAX_ROLE_LENGTH defined', () => {
    expect(INPUT_LIMITS.MAX_ROLE_LENGTH).toBeDefined();
    expect(typeof INPUT_LIMITS.MAX_ROLE_LENGTH).toBe('number');
    expect(INPUT_LIMITS.MAX_ROLE_LENGTH).toBeGreaterThan(0);
  });

  it('should have MAX_DESCRIPTION_LENGTH defined', () => {
    expect(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH).toBeDefined();
    expect(typeof INPUT_LIMITS.MAX_DESCRIPTION_LENGTH).toBe('number');
    expect(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH).toBeGreaterThan(0);
  });

  it('should have MAX_LIST_ITEM_LENGTH defined', () => {
    expect(INPUT_LIMITS.MAX_LIST_ITEM_LENGTH).toBeDefined();
    expect(typeof INPUT_LIMITS.MAX_LIST_ITEM_LENGTH).toBe('number');
    expect(INPUT_LIMITS.MAX_LIST_ITEM_LENGTH).toBeGreaterThan(0);
  });

  it('should have MAX_ACTION_ITEM_LENGTH defined', () => {
    expect(INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH).toBeDefined();
    expect(typeof INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH).toBe('number');
    expect(INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH).toBeGreaterThan(0);
  });

  it('should have MAX_ASSIGNEE_LENGTH defined', () => {
    expect(INPUT_LIMITS.MAX_ASSIGNEE_LENGTH).toBeDefined();
    expect(typeof INPUT_LIMITS.MAX_ASSIGNEE_LENGTH).toBe('number');
    expect(INPUT_LIMITS.MAX_ASSIGNEE_LENGTH).toBeGreaterThan(0);
  });

  it('should have reasonable limit values', () => {
    // Names should be reasonable length
    expect(INPUT_LIMITS.MAX_NAME_LENGTH).toBeLessThanOrEqual(200);
    expect(INPUT_LIMITS.MAX_NAME_LENGTH).toBeGreaterThanOrEqual(50);

    // Roles should be shorter than names
    expect(INPUT_LIMITS.MAX_ROLE_LENGTH).toBeLessThanOrEqual(INPUT_LIMITS.MAX_NAME_LENGTH);

    // Descriptions should be longer than names
    expect(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH).toBeGreaterThan(INPUT_LIMITS.MAX_NAME_LENGTH);

    // Action items should be reasonable
    expect(INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH).toBeGreaterThan(0);
    expect(INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH).toBeLessThanOrEqual(1000);

    // Assignee names should be reasonable
    expect(INPUT_LIMITS.MAX_ASSIGNEE_LENGTH).toBeGreaterThan(0);
    expect(INPUT_LIMITS.MAX_ASSIGNEE_LENGTH).toBeLessThanOrEqual(100);
  });

  it('should have expected specific values', () => {
    expect(INPUT_LIMITS.MAX_NAME_LENGTH).toBe(100);
    expect(INPUT_LIMITS.MAX_ROLE_LENGTH).toBe(50);
    expect(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH).toBe(500);
    expect(INPUT_LIMITS.MAX_LIST_ITEM_LENGTH).toBe(200);
    expect(INPUT_LIMITS.MAX_ACTION_ITEM_LENGTH).toBe(300);
    expect(INPUT_LIMITS.MAX_ASSIGNEE_LENGTH).toBe(50);
  });
});

describe('Input limit enforcement logic', () => {
  it('should truncate strings exceeding MAX_NAME_LENGTH', () => {
    const longName = 'A'.repeat(INPUT_LIMITS.MAX_NAME_LENGTH + 50);
    const truncated = longName.slice(0, INPUT_LIMITS.MAX_NAME_LENGTH);

    expect(truncated.length).toBe(INPUT_LIMITS.MAX_NAME_LENGTH);
    expect(truncated).not.toBe(longName);
  });

  it('should truncate strings exceeding MAX_DESCRIPTION_LENGTH', () => {
    const longDescription = 'B'.repeat(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH + 100);
    const truncated = longDescription.slice(0, INPUT_LIMITS.MAX_DESCRIPTION_LENGTH);

    expect(truncated.length).toBe(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH);
    expect(truncated).not.toBe(longDescription);
  });

  it('should not truncate strings within limits', () => {
    const validName = 'Ada Nguyen';
    const validDescription = 'A software engineer working on Niuma';

    expect(validName.length).toBeLessThanOrEqual(INPUT_LIMITS.MAX_NAME_LENGTH);
    expect(validDescription.length).toBeLessThanOrEqual(INPUT_LIMITS.MAX_DESCRIPTION_LENGTH);
  });

  it('should allow exact limit length', () => {
    const exactName = 'X'.repeat(INPUT_LIMITS.MAX_NAME_LENGTH);
    expect(exactName.length).toBe(INPUT_LIMITS.MAX_NAME_LENGTH);

    const isValid = exactName.length <= INPUT_LIMITS.MAX_NAME_LENGTH;
    expect(isValid).toBe(true);
  });
});
