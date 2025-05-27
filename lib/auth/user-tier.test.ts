import { getCurrentUser } from '@/lib/auth/get-current-user';
import { createClient as importedCreateSupabaseClient } from '@/lib/supabase/server';
import { afterEach, beforeEach, describe, jest } from '@jest/globals';
import { getUserTier } from './user-tier';

// Mock both dependencies
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: jest.fn(),
}));

// Type for the individual table query mock results
type MockQueryResult = { data: any; error: any };

describe('getUserTier', () => {
  // Mocks for the fluent API calls
  let mockProfileSingle: jest.Mock<() => Promise<MockQueryResult>>;
  let mockSubscriptionMaybeSingle: jest.Mock<() => Promise<MockQueryResult>>;
  let mockFrom: jest.Mock<any>;
  
  const mockedGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

  beforeEach(() => {
    // Reset all mocks
    (importedCreateSupabaseClient as jest.Mock).mockClear();
    mockedGetCurrentUser.mockClear();
    
    mockProfileSingle = jest.fn();
    mockSubscriptionMaybeSingle = jest.fn();

    // Setup the main .from() mock
    mockFrom = jest.fn();

    (importedCreateSupabaseClient as jest.Mock).mockReturnValue({ from: mockFrom });

    // Make .from() return different chains based on the table name
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: mockProfileSingle,
        };
      }
      if (tableName === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          maybeSingle: mockSubscriptionMaybeSingle,
        };
      }
      // Fallback
      return {
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single: jest.fn(), maybeSingle: jest.fn() })) })),
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- Basic non-database call tests ---
  test('should return "unknown" if no userId is provided', async () => {
    const tier = await getUserTier('');
    expect(tier).toBe('unknown');
    expect(importedCreateSupabaseClient).not.toHaveBeenCalled();
  });

  test('should return "unknown" if userId is "anonymous" and not call Supabase client', async () => {
    const tier = await getUserTier('anonymous');
    expect(tier).toBe('unknown');
    expect(importedCreateSupabaseClient).not.toHaveBeenCalled();
  });

  // --- Tests involving getCurrentUser ---
  test('should return "unknown" if getCurrentUser returns null', async () => {
    mockedGetCurrentUser.mockResolvedValueOnce(null);
    const tier = await getUserTier('user123');
    expect(tier).toBe('unknown');
  });

  test('should return "unknown" if getCurrentUser returns different user', async () => {
    mockedGetCurrentUser.mockResolvedValueOnce({ id: 'different-user', is_anonymous: false } as any);
    const tier = await getUserTier('user123');
    expect(tier).toBe('unknown');
  });

  test('should return "guest" if getCurrentUser returns anonymous user', async () => {
    mockedGetCurrentUser.mockResolvedValueOnce({ id: 'user123', is_anonymous: true } as any);
    const tier = await getUserTier('user123');
    expect(tier).toBe('guest');
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
    expect(mockFrom).not.toHaveBeenCalledWith('subscriptions');
  });

  // --- Tests for non-anonymous users ---
  describe('when user is not anonymous', () => {
    beforeEach(() => {
      // For this block, assume getCurrentUser returns non-anonymous user
      mockedGetCurrentUser.mockResolvedValue({ id: 'user123', is_anonymous: false } as any);
    });

    test('should return "unknown" if profile not found in profiles table (PGRST116)', async () => {
      mockProfileSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      const tier = await getUserTier('user123');
      expect(tier).toBe('unknown');
      expect(mockFrom).toHaveBeenCalledWith('profiles');
      expect(mockProfileSingle).toHaveBeenCalled();
    });

    test('should return "unknown" on other error fetching profile for non-anonymous user', async () => {
      mockProfileSingle.mockResolvedValueOnce({ data: null, error: { code: 'DB_ERROR', message: 'db error' } });
      const tier = await getUserTier('user123');
      expect(tier).toBe('unknown');
    });

    describe('and profile exists', () => {
      beforeEach(() => {
        // For this block, assume profile exists
        mockProfileSingle.mockResolvedValue({ data: { id: 'user123' }, error: null });
      });

      test('should return "free" if no active/trialing subscription', async () => {
        mockSubscriptionMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
        const tier = await getUserTier('user123');
        expect(tier).toBe('free');
        expect(mockFrom).toHaveBeenCalledWith('subscriptions');
        expect(mockSubscriptionMaybeSingle).toHaveBeenCalled();
      });

      test('should return "pro" if "active" subscription exists', async () => {
        mockSubscriptionMaybeSingle.mockResolvedValueOnce({ data: { status: 'active' }, error: null });
        const tier = await getUserTier('user123');
        expect(tier).toBe('pro');
      });

      test('should return "pro" if "trialing" subscription exists', async () => {
        mockSubscriptionMaybeSingle.mockResolvedValueOnce({ data: { status: 'trialing' }, error: null });
        const tier = await getUserTier('user123');
        expect(tier).toBe('pro');
      });

      test('should return "free" if subscription fetch fails', async () => {
        mockSubscriptionMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'sub error' } });
        const tier = await getUserTier('user123');
        expect(tier).toBe('free');
      });
    });
  });

  // Test for unexpected createSupabaseClient error
  test('should return "unknown" if createSupabaseClient fails', async () => {
    (importedCreateSupabaseClient as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Client creation failed');
    });
    const tier = await getUserTier('user123');
    expect(tier).toBe('unknown');
  });
}); 