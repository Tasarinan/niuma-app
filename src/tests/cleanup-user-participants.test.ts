import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module
vi.mock('@/lib/database/config', () => ({
  getDatabase: vi.fn(),
}));

// Mock the context builder
vi.mock('@/lib/functions/context-builder', () => ({
  invalidateContextCache: vi.fn(),
}));

describe('cleanupUserFromParticipants', () => {
  let mockDb: {
    select: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };
  let mockGetDatabase: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await vi.resetModules();

    // Setup mock database
    mockDb = {
      select: vi.fn(),
      execute: vi.fn(),
    };
    mockGetDatabase = vi.fn().mockResolvedValue(mockDb);

    // Override the mock
    const dbConfig = await import('@/lib/database/config');
    (dbConfig.getDatabase as any) = mockGetDatabase;
  });

  it('should do nothing when userName is empty', async () => {
    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('');

    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  it('should do nothing when userName is whitespace only', async () => {
    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('   ');

    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  it('should do nothing when userName is null/undefined', async () => {
    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants(null as any);
    await cleanupUserFromParticipants(undefined as any);

    expect(mockGetDatabase).not.toHaveBeenCalled();
  });

  it('should remove user name (case-insensitive) from participants', async () => {
    // Mock summaries with participants including the user in different cases
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Test meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Kevin", "Alice", "Bob"]',
        exchange_count: 10,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'summary-2',
        conversation_id: 'conv-2',
        summary: 'Another meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["KEVIN", "Charlie"]', // Uppercase
        exchange_count: 5,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
      {
        id: 'summary-3',
        conversation_id: 'conv-3',
        summary: 'Third meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Alice", "Bob"]', // No Kevin
        exchange_count: 3,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    mockDb.execute.mockResolvedValue({});

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('Kevin');

    // Should update summary-1 and summary-2, but not summary-3
    expect(mockDb.execute).toHaveBeenCalledTimes(2);

    // Verify first update removed Kevin
    const firstCall = mockDb.execute.mock.calls[0];
    expect(firstCall[0]).toContain('UPDATE meeting_summaries');
    expect(firstCall[1][0]).toBe('["Alice","Bob"]');

    // Verify second update removed KEVIN (case-insensitive)
    const secondCall = mockDb.execute.mock.calls[1];
    expect(secondCall[1][0]).toBe('["Charlie"]');
  });

  it('should handle summary with user as only participant', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Solo meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Kevin"]', // Only Kevin
        exchange_count: 1,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    mockDb.execute.mockResolvedValue({});

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('Kevin');

    // Should update to empty array
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(mockDb.execute.mock.calls[0][1][0]).toBe('[]');
  });

  it('should handle empty participants array', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Empty meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '[]', // Empty
        exchange_count: 0,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('Kevin');

    // Should not update since no change
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('should trim whitespace from userName before comparison', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Test meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Kevin", "Alice"]',
        exchange_count: 5,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    mockDb.execute.mockResolvedValue({});

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    // Pass name with whitespace
    await cleanupUserFromParticipants('  Kevin  ');

    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(mockDb.execute.mock.calls[0][1][0]).toBe('["Alice"]');
  });

  it('should handle multiple occurrences of user name', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Duplicate meeting',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Kevin", "Alice", "kevin", "KEVIN"]', // Multiple Kevins
        exchange_count: 5,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    mockDb.execute.mockResolvedValue({});

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('Kevin');

    // Should remove all case variations
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect(mockDb.execute.mock.calls[0][1][0]).toBe('["Alice"]');
  });

  it('should invalidate context cache after cleanup', async () => {
    const { invalidateContextCache } = await import(
      '@/lib/functions/context-builder'
    );

    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Test',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Kevin", "Alice"]',
        exchange_count: 1,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    mockDb.execute.mockResolvedValue({});

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('Kevin');

    expect(invalidateContextCache).toHaveBeenCalled();
  });

  it('should not invalidate cache when no updates made', async () => {
    const { invalidateContextCache } = await import(
      '@/lib/functions/context-builder'
    );

    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Test',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Alice", "Bob"]', // No Kevin
        exchange_count: 1,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await cleanupUserFromParticipants('Kevin');

    expect(invalidateContextCache).not.toHaveBeenCalled();
  });

  it('should handle database read failure gracefully (returns empty)', async () => {
    // getAllMeetingSummaries catches errors and returns empty array
    mockDb.select.mockRejectedValueOnce(new Error('Database error'));

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    // Should not throw - getAllMeetingSummaries catches and returns []
    await expect(cleanupUserFromParticipants('Kevin')).resolves.toBeUndefined();
  });

  it('should throw error on database write failure', async () => {
    mockDb.select.mockResolvedValueOnce([
      {
        id: 'summary-1',
        conversation_id: 'conv-1',
        summary: 'Test',
        title: null,
        topics: '[]',
        goals: '[]',
        action_items: '[]',
        next_steps: '[]',
        decisions: '[]',
        team_updates: '[]',
        participants: '["Kevin", "Alice"]',
        exchange_count: 1,
        duration_seconds: null,
        created_at: Date.now(),
        updated_at: Date.now(),
      },
    ]);

    // Execute fails when trying to update
    mockDb.execute.mockRejectedValueOnce(new Error('Write error'));

    const { cleanupUserFromParticipants } = await import(
      '@/lib/database/meeting-context.action'
    );

    await expect(cleanupUserFromParticipants('Kevin')).rejects.toThrow(
      'Write error'
    );
  });
});
