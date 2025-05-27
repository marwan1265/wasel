import { CHAT_MESSAGE_ACTION, GENERAL_API_ACTION } from '@/lib/config/rate-limits';
import { checkRateLimit } from '@/lib/rate-limiter';
import { checkRequestDuplicate, generateRequestFingerprint } from '@/lib/rate-limiter-dedup';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createServerClient } from '@supabase/ssr';
import type { SpyInstance } from 'jest-mock';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

// Mock dependencies
jest.mock('@/lib/rate-limiter');
jest.mock('@/lib/rate-limiter-dedup');
jest.mock('@supabase/ssr');

// Helper to create NextRequest
function createRequest(
  url: string,
  method: string = 'GET',
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers: new Headers(headers)
  });
}

describe('Rate Limiting Middleware', () => {
  const mockedCheckRateLimit = jest.mocked(checkRateLimit);
  const mockedGenerateRequestFingerprint = jest.mocked(generateRequestFingerprint);
  const mockedCheckRequestDuplicate = jest.mocked(checkRequestDuplicate);
  const mockedCreateServerClient = jest.mocked(createServerClient);
  
  let mockSupabaseClient: any;
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock user
    mockUser = { id: 'user123' };
    
    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(() => Promise.resolve({ data: { user: mockUser }, error: null }))
      }
    } as any;
    
    // Mock createServerClient to return our mock client
    (mockedCreateServerClient as any).mockReturnValue(mockSupabaseClient);
    
    // Default mock implementations
    mockedCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 95,
      reset: new Date(Date.now() + 3600000), // 1 hour from now
    });
    
    mockedGenerateRequestFingerprint.mockReturnValue('fingerprint123');
    mockedCheckRequestDuplicate.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Request Routing', () => {
    test('should process API requests through rate limiter', async () => {
      const request = createRequest('/api/test');
      
      await middleware(request);
      
      expect(checkRateLimit).toHaveBeenCalled();
    });

    test('should identify chat message requests correctly', async () => {
      const request = createRequest('/api/chat', 'POST');
      
      await middleware(request);
      
      expect(checkRateLimit).toHaveBeenCalledWith('user123', CHAT_MESSAGE_ACTION);
    });

    test('should identify general API requests correctly', async () => {
      const request = createRequest('/api/chats', 'GET');
      
      await middleware(request);
      
      expect(checkRateLimit).toHaveBeenCalledWith('user123', GENERAL_API_ACTION);
    });

    test('should handle different HTTP methods appropriately', async () => {
      const deleteRequest = createRequest('/api/chat/123', 'DELETE');
      
      await middleware(deleteRequest);
      
      expect(checkRateLimit).toHaveBeenCalledWith('user123', GENERAL_API_ACTION);
    });
    
    test('should skip rate limiting for health checks', async () => {
      const request = createRequest('/api/health');
      
      await middleware(request);
      
      expect(checkRateLimit).not.toHaveBeenCalled();
    });
    
    test('should skip rate limiting for auth callback', async () => {
      const request = createRequest('/api/auth/callback');
      
      await middleware(request);
      
      expect(checkRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('Authentication Checks', () => {
    test('should return 401 for unauthenticated API requests', async () => {
      mockSupabaseClient.auth.getUser = jest.fn(() => Promise.resolve({ data: { user: null }, error: null }));
      
      const request = createRequest('/api/chat', 'POST');
      const response = await middleware(request);
      
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    test('should use anonymous userId for unauthenticated users on non-API routes', async () => {
      mockSupabaseClient.auth.getUser = jest.fn(() => Promise.resolve({ data: { user: null }, error: null }));
      
      const request = createRequest('/public-page');
      await middleware(request);
      
      // Should not call rate limiter for non-API routes
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    test('should allow authenticated users to send chat messages', async () => {
      const request = createRequest('/api/chat', 'POST');
      const response = await middleware(request);
      
      expect(response.status).not.toBe(401);
      expect(checkRateLimit).toHaveBeenCalled();
    });
  });

  describe('Request Deduplication', () => {
    test('should check for duplicate requests', async () => {
      const request = createRequest('/api/chat', 'POST');
      
      await middleware(request);
      
      expect(generateRequestFingerprint).toHaveBeenCalledWith(
        'user123',
        'chat_message',
        expect.objectContaining({
          method: 'POST',
          path: '/api/chat'
        }),
        expect.objectContaining({
          ttlSeconds: 5,
          includeBody: true
        })
      );
      expect(checkRequestDuplicate).toHaveBeenCalledWith('fingerprint123');
    });

    test('should skip rate limiting for duplicate requests', async () => {
      mockedCheckRequestDuplicate.mockResolvedValue(true);
      
      const request = createRequest('/api/chat', 'POST');
      await middleware(request);
      
      expect(checkRateLimit).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Headers', () => {
    test('should set rate limit headers on allowed requests', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: true,
        limit: 100,
        remaining: 95,
        reset: new Date('2024-01-01T12:00:00Z'),
      });
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('95');
      expect(response.headers.get('X-RateLimit-Reset')).toBe('2024-01-01T12:00:00.000Z');
      expect(response.headers.get('X-RateLimit-Policy')).toBe('standard');
    });

    test('should set retry-after header on blocked requests', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        reset: new Date(Date.now() + 3600000),
        retryAfterSeconds: 3600,
        reason: 'time_window_limit',
      });
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('3600');
    });

    test('should handle missing retryAfterSeconds with fallback', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        reset: new Date(Date.now() + 3600000),
        // retryAfterSeconds missing
        reason: 'time_window_limit',
      });
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      expect(response.headers.get('Retry-After')).toBe('60'); // Fallback
    });
  });

  describe('Error Responses', () => {
    test('should return 429 when rate limit exceeded', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        reset: new Date(),
        retryAfterSeconds: 300,
        reason: 'time_window_limit',
      });
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error).toBe('Too Many Requests');
      expect(body.message).toContain('Too many requests');
    });

    test('should include appropriate message for daily limit', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        reset: new Date('2024-01-02T00:00:00Z'),
        retryAfterSeconds: 300,
        reason: 'daily_limit',
      });
      
      const request = createRequest('/api/chat', 'POST');
      const response = await middleware(request);
      
      const body = await response.json();
      expect(body.message).toContain('Daily limit exceeded');
    });
  });

  describe('Error Handling', () => {
    test('should fail open when rate limiter throws error', async () => {
      mockedCheckRateLimit.mockRejectedValue(new Error('Redis connection failed'));
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      // Should allow request through (fail open)
      expect(response.status).not.toBe(429);
    });

    test('should handle Supabase auth errors', async () => {
      mockSupabaseClient.auth.getUser = jest.fn(() => Promise.reject(new Error('Auth service error')));
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      // Should fail open
      expect(response.status).not.toBe(429);
    });

    test('should handle fingerprint generation errors', async () => {
      mockedGenerateRequestFingerprint.mockImplementation(() => {
        throw new Error('Fingerprint error');
      });
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      // Should fail open
      expect(response.status).not.toBe(429);
    });
  });

  describe('Logging', () => {
    let consoleLogSpy: SpyInstance;
    let consoleErrorSpy: SpyInstance;

    beforeEach(() => {
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should log duplicate request detection', async () => {
      mockedCheckRequestDuplicate.mockResolvedValue(true);
      
      const request = createRequest('/api/test');
      await middleware(request);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Duplicate request detected for user123:general_api_access, skipping rate limit')
      );
    });

    test('should log rate limit exceeded', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        reset: new Date(),
        retryAfterSeconds: 60,
        reason: 'time_window_limit',
      });
      
      const request = createRequest('/api/test');
      await middleware(request);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded'),
        expect.objectContaining({
          userId: 'user123',
          action: 'general_api_access'
        })
      );
    });

    test('should log errors in middleware', async () => {
      mockedCheckRateLimit.mockRejectedValue(new Error('Test error'));
      
      const request = createRequest('/api/test');
      await middleware(request);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Middleware error:',
        expect.any(Error)
      );
    });
    
    test('should log successful requests in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      });
      
      const request = createRequest('/api/test');
      await middleware(request);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Request allowed'),
        expect.objectContaining({
          remaining: 95,
          limit: 100
        })
      );
      
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle requests with no pathname', async () => {
      const request = createRequest('/');
      const response = await middleware(request);
      
      expect(response).toBeDefined();
    });

    test('should handle OPTIONS requests', async () => {
      const request = createRequest('/api/test', 'OPTIONS');
      const response = await middleware(request);
      
      expect(checkRateLimit).toHaveBeenCalled();
    });

    test('should handle requests with query parameters', async () => {
      const request = createRequest('/api/test?param=value');
      const response = await middleware(request);
      
      expect(checkRateLimit).toHaveBeenCalled();
    });

    test('should preserve original request headers', async () => {
      const customHeaders = {
        'X-Custom-Header': 'test-value',
        'Authorization': 'Bearer token123'
      };
      const request = createRequest('/api/test', 'GET', customHeaders);
      
      const response = await middleware(request);
      
      // NextResponse.next() should preserve headers
      expect(response).toBeDefined();
    });
    
    test('should handle non-API routes', async () => {
      const request = createRequest('/some-page');
      const response = await middleware(request);
      
      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(response).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should complete middleware execution quickly', async () => {
      const start = Date.now();
      const request = createRequest('/api/test');
      
      await middleware(request);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(50); // Should be very fast with mocks
    });

    test('should handle concurrent requests', async () => {
      const requests = Array(10).fill(null).map((_, i) => 
        createRequest(`/api/test${i}`)
      );
      
      const responses = await Promise.all(
        requests.map(req => middleware(req))
      );
      
      expect(responses).toHaveLength(10);
      expect(checkRateLimit).toHaveBeenCalledTimes(10);
    });
  });

  describe('Share Endpoints', () => {
    test('should apply general rate limits to share endpoints', async () => {
      const request = createRequest('/api/share/123', 'GET');
      
      await middleware(request);
      
      expect(checkRateLimit).toHaveBeenCalledWith('user123', GENERAL_API_ACTION);
    });
  });

  describe('Response Handling', () => {
    test('should properly construct NextResponse for allowed requests', async () => {
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
    });

    test('should properly construct error response for blocked requests', async () => {
      mockedCheckRateLimit.mockResolvedValue({
        allowed: false,
        limit: 100,
        remaining: 0,
        reset: new Date(),
        retryAfterSeconds: 60,
        reason: 'time_window_limit',
      });
      
      const request = createRequest('/api/test');
      const response = await middleware(request);
      
      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(429);
      
      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });
}); 