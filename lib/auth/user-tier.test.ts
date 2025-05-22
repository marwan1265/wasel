import { createClient as importedCreateSupabaseClient } from '@/lib/supabase/server';
import { afterEach, beforeEach, describe, jest } from '@jest/globals';
import { getUserTier } from './user-tier';

// This is THE mock function for the Supabase client factory
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

// Type for the individual table query mock results
type MockQueryResult = { data: any; error: any };

describe('getUserTier', () => {
  // Mocks for the fluent API calls, scoped to be fresh for each table mock chain
  let mockAuthUserSingle: jest.Mock<() => Promise<MockQueryResult>>;
  let mockProfileSingle: jest.Mock<() => Promise<MockQueryResult>>;
  let mockSubscriptionMaybeSingle: jest.Mock<() => Promise<MockQueryResult>>;

  let mockFrom: jest.Mock<any>; // This will be the root .from() mock

  beforeEach(() => {
    // Reset the main createClient mock and all specific query mocks
    (importedCreateSupabaseClient as jest.Mock).mockClear();
    mockAuthUserSingle = jest.fn();
    mockProfileSingle = jest.fn();
    mockSubscriptionMaybeSingle = jest.fn();

    // Setup the main .from() mock
    mockFrom = jest.fn();

    (importedCreateSupabaseClient as jest.Mock).mockReturnValue({ from: mockFrom });

    // Make .from() return different chains based on the table name
    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === 'users') {
        return {
          select: jest.fn().mockReturnThis(), // .select() returns the same object for chaining
          eq: jest.fn().mockReturnThis(),     // .eq() returns the same object for chaining
          single: mockAuthUserSingle,         // .single() for auth.users calls
        };
      }
      if (tableName === 'profiles') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: mockProfileSingle,          // .single() for profiles calls
        };
      }
      if (tableName === 'subscriptions') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),    // .in() for subscriptions
          maybeSingle: mockSubscriptionMaybeSingle, // .maybeSingle() for subscriptions
        };
      }
      // Fallback for any other table name, though not expected by getUserTier
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
    (importedCreateSupabaseClient as jest.Mock).mockClear(); // Ensure no previous calls interfere
    const tier = await getUserTier('');
    expect(tier).toBe('unknown');
    expect(importedCreateSupabaseClient).not.toHaveBeenCalled();
  });

  test('should return "unknown" if userId is "anonymous" and not call Supabase client', async () => {
    (importedCreateSupabaseClient as jest.Mock).mockClear();
    const tier = await getUserTier('anonymous');
    expect(tier).toBe('unknown');
    expect(importedCreateSupabaseClient).not.toHaveBeenCalled();
  });

  // --- Tests involving auth.users table ---
  test('should return "unknown" if userId not found in auth.users (PGRST116)', async () => {
    mockAuthUserSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
    const tier = await getUserTier('user123');
    expect(tier).toBe('unknown');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockAuthUserSingle).toHaveBeenCalled();
  });

  test('should return "unknown" on other error fetching from auth.users', async () => {
    mockAuthUserSingle.mockResolvedValueOnce({ data: null, error: { code: 'DB_ERROR', message: 'db error' } });
    const tier = await getUserTier('user123');
    expect(tier).toBe('unknown');
  });

  test('should return "guest" if auth.users.is_anonymous is true', async () => {
    mockAuthUserSingle.mockResolvedValueOnce({ data: { is_anonymous: true }, error: null });
    // No further calls to profiles or subscriptions should be made
    const tier = await getUserTier('user123');
    expect(tier).toBe('guest');
    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(mockFrom).not.toHaveBeenCalledWith('profiles');
    expect(mockFrom).not.toHaveBeenCalledWith('subscriptions');
  });

  // --- Tests for non-anonymous users (is_anonymous: false from auth.users) ---
  describe('when user is not anonymous in auth.users', () => {
    beforeEach(() => {
      // For this block, assume user exists in auth.users and is_anonymous is false
      mockAuthUserSingle.mockResolvedValue({ data: { is_anonymous: false }, error: null });
    });

    test('should return "unknown" if profile not found in profiles table (PGRST116)', async () => {
      mockProfileSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'not found' } });
      const tier = await getUserTier('user123');
      expect(tier).toBe('unknown');
      expect(mockFrom).toHaveBeenCalledWith('users');
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
        mockProfileSingle.mockResolvedValue({ data: { id: 'user123' /* email no longer matters here */ }, error: null });
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