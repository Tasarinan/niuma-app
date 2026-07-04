import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { STORAGE_KEYS } from '@/config';

describe('user-identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset localStorage mock
    (global.localStorage.getItem as any).mockReset();
    (global.localStorage.setItem as any).mockReset();
    (global.localStorage.removeItem as any).mockReset();
  });

  describe('getUserIdentity', () => {
    it('should return null when no identity is stored', async () => {
      (global.localStorage.getItem as any).mockReturnValue(null);

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
      expect(global.localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_IDENTITY);
    });

    it('should return parsed identity when valid JSON is stored', async () => {
      const storedIdentity = { name: 'Kevin', role: 'Software Engineer' };
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify(storedIdentity));

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toEqual(storedIdentity);
    });

    it('should return null for invalid JSON', async () => {
      (global.localStorage.getItem as any).mockReturnValue('not valid json');

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
    });

    it('should return null when stored object is missing name', async () => {
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify({ role: 'Engineer' }));

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
    });

    it('should return null when stored object is missing role', async () => {
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify({ name: 'Kevin' }));

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
    });

    it('should return null when name is not a string', async () => {
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify({ name: 123, role: 'Engineer' }));

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
    });

    it('should return null when role is not a string', async () => {
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify({ name: 'Kevin', role: 456 }));

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
    });

    it('should return null for null stored value', async () => {
      (global.localStorage.getItem as any).mockReturnValue(JSON.stringify(null));

      const { getUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = getUserIdentity();

      expect(result).toBeNull();
    });
  });

  describe('setUserIdentity', () => {
    it('should store identity as JSON string', async () => {
      const identity = { name: 'Kevin', role: 'Software Engineer' };

      const { setUserIdentity } = await import('@/lib/storage/user-identity.storage');
      setUserIdentity(identity);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_IDENTITY,
        JSON.stringify(identity)
      );
    });

    it('should handle empty strings', async () => {
      const identity = { name: '', role: '' };

      const { setUserIdentity } = await import('@/lib/storage/user-identity.storage');
      setUserIdentity(identity);

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.USER_IDENTITY,
        JSON.stringify(identity)
      );
    });
  });

  describe('hasUserIdentity', () => {
    it('should return false when no identity is stored', async () => {
      (global.localStorage.getItem as any).mockReturnValue(null);

      const { hasUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = hasUserIdentity();

      expect(result).toBe(false);
    });

    it('should return false when name is empty', async () => {
      (global.localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ name: '', role: 'Engineer' })
      );

      const { hasUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = hasUserIdentity();

      expect(result).toBe(false);
    });

    it('should return false when role is empty', async () => {
      (global.localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ name: 'Kevin', role: '' })
      );

      const { hasUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = hasUserIdentity();

      expect(result).toBe(false);
    });

    it('should return false when name is whitespace only', async () => {
      (global.localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ name: '   ', role: 'Engineer' })
      );

      const { hasUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = hasUserIdentity();

      expect(result).toBe(false);
    });

    it('should return false when role is whitespace only', async () => {
      (global.localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ name: 'Kevin', role: '   ' })
      );

      const { hasUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = hasUserIdentity();

      expect(result).toBe(false);
    });

    it('should return true when both name and role have content', async () => {
      (global.localStorage.getItem as any).mockReturnValue(
        JSON.stringify({ name: 'Kevin', role: 'Software Engineer' })
      );

      const { hasUserIdentity } = await import('@/lib/storage/user-identity.storage');
      const result = hasUserIdentity();

      expect(result).toBe(true);
    });
  });

  describe('clearUserIdentity', () => {
    it('should remove identity from localStorage', async () => {
      const { clearUserIdentity } = await import('@/lib/storage/user-identity.storage');
      clearUserIdentity();

      expect(global.localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_IDENTITY);
    });
  });
});
