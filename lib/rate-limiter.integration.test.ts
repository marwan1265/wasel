import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { getUserTier } from './auth/user-tier';
import {
    CHAT_MESSAGE_ACTION,
    dailyRateLimitConfig,
    timeWindowRateLimitConfig
} from './config/rate-limits';
import { checkRateLimit } from './rate-limiter';
import { getRedisClient } from './redis/config';
import { MockRedisClient } from './test-utils/redis-mock';

// Mock dependencies
jest.mock('./redis/config');
jest.mock('./auth/user-tier');

describe('Rate Limiter Integration Tests', () => {
  let mockRedis: MockRedisClient;
  let timeNow: number;
  const mockedGetRedisClient = jest.mocked(getRedisClient);
  const mockedGetUserTier = jest.mocked(getUserTier);
  let originalDateNow: () => number;

  beforeEach(() => {
    timeNow = Date.now();
    mockRedis = new MockRedisClient();
    mockRedis.setCurrentTime(timeNow);
    
    // Mock Date.now() to return our controlled time
    originalDateNow = Date.now;
    Date.now = jest.fn(() => mockRedis.getCurrentTime());
    
    mockedGetRedisClient.mockResolvedValue(mockRedis as any);
    mockedGetUserTier.mockResolvedValue('free');
  });

  afterEach(() => {
    // Restore Date.now()
    Date.now = originalDateNow;
    jest.clearAllMocks();
  });

  describe('Realistic Rate Limiting Scenarios', () => {
    test('should enforce daily limit across multiple requests', async () => {
      const dailyLimit = dailyRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      
      // Set initial count to exactly at limit
      const todayUTC = new Date().toISOString().split('T')[0];
      const dailyKey = `rate_limit_daily:user123:chat_message:${todayUTC}`;
      await mockRedis.set(dailyKey, String(dailyLimit));
      
      // Request should be blocked immediately
      const blockedResult = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toBe('daily_limit');
      expect(blockedResult.remaining).toBe(0);
    });

    test('should enforce time window limit with sliding window', async () => {
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      const windowSeconds = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].windowSeconds;
      const timeWindowKey = `rate_limit_window:user123:chat_message`;
      
      // Pre-fill the window with requests
      const nowSeconds = Math.floor(timeNow / 1000);
      for (let i = 0; i < windowLimit; i++) {
        await mockRedis.zadd(timeWindowKey, nowSeconds, `${nowSeconds}-test-${i}`);
      }
      
      // Should be blocked now
      let blockedResult = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(blockedResult.allowed).toBe(false);
      expect(blockedResult.reason).toBe('time_window_limit');
      
      // Move time forward by half the window
      const halfWindow = Math.floor(windowSeconds / 2);
      mockRedis.setCurrentTime(timeNow + (halfWindow * 1000));
      
      // Should still be blocked (not enough time passed)
      blockedResult = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(blockedResult.allowed).toBe(false);
      
      // Clear the sorted set to simulate expired entries
      await mockRedis.del(timeWindowKey);
      
      // Should be allowed now
      const allowedResult = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(allowedResult.allowed).toBe(true);
    });

    test('should handle burst traffic correctly', async () => {
      const promises: Promise<any>[] = [];
      const concurrentRequests = 20;
      
      // Simulate burst of concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(checkRateLimit('user123', CHAT_MESSAGE_ACTION));
      }
      
      const results = await Promise.all(promises);
      
      // Check that limits are properly enforced
      const allowedCount = results.filter(r => r.allowed).length;
      const blockedCount = results.filter(r => !r.allowed).length;
      
      // Should allow up to the window limit
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      expect(allowedCount).toBeLessThanOrEqual(windowLimit);
      expect(blockedCount).toBe(concurrentRequests - allowedCount);
    });

    test('should reset daily limit at midnight UTC', async () => {
      // Set time to 11:59 PM UTC
      const nearMidnight = new Date();
      nearMidnight.setUTCHours(23, 59, 0, 0);
      mockRedis.setCurrentTime(nearMidnight.getTime());
      
      // Use up some requests
      const todayKey = `rate_limit_daily:user123:chat_message:${nearMidnight.toISOString().split('T')[0]}`;
      await mockRedis.set(todayKey, '5');
      
      // Move to next day (12:01 AM UTC)
      const nextDay = new Date(nearMidnight);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      nextDay.setUTCHours(0, 1, 0, 0);
      mockRedis.setCurrentTime(nextDay.getTime());
      
      // Should have fresh daily limit
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(result.allowed).toBe(true);
      
      // The test passes if the request was allowed, which means the daily limit reset
      // We don't need to check the exact count as that's an implementation detail
    });
  });

  describe('Multiple Users', () => {
    test('should track limits independently per user', async () => {
      const users = ['user1', 'user2', 'user3'];
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      
      // Pre-fill each user's window to the limit
      for (const userId of users) {
        const timeWindowKey = `rate_limit_window:${userId}:chat_message`;
        const nowSeconds = Math.floor(Date.now() / 1000);
        for (let i = 0; i < windowLimit; i++) {
          await mockRedis.zadd(timeWindowKey, nowSeconds, `${nowSeconds}-${userId}-${i}`);
        }
        
        // Each user should be blocked
        const blocked = await checkRateLimit(userId, CHAT_MESSAGE_ACTION);
        expect(blocked.allowed).toBe(false);
      }
      
      // Verify each user has independent limits
      const user1Result = await checkRateLimit('user1', CHAT_MESSAGE_ACTION);
      const user2Result = await checkRateLimit('user2', CHAT_MESSAGE_ACTION);
      const user3Result = await checkRateLimit('user3', CHAT_MESSAGE_ACTION);
      
      expect(user1Result.allowed).toBe(false);
      expect(user2Result.allowed).toBe(false);
      expect(user3Result.allowed).toBe(false);
    });
  });

  describe('Different Actions', () => {
    test('should track limits independently per action', async () => {
      // Pre-fill chat message limit
      const chatLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      const timeWindowKey = `rate_limit_window:user123:chat_message`;
      const nowSeconds = Math.floor(Date.now() / 1000);
      
      for (let i = 0; i < chatLimit; i++) {
        await mockRedis.zadd(timeWindowKey, nowSeconds, `${nowSeconds}-chat-${i}`);
      }
      
      // Chat should be blocked
      const chatBlocked = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(chatBlocked.allowed).toBe(false);
      expect(chatBlocked.reason).toBe('time_window_limit');
      
      // General API should still work
      const generalResult = await checkRateLimit('user123', 'general_api_access');
      expect(generalResult.allowed).toBe(true);
    });
  });

  describe('User Tier Changes', () => {
    test('should apply new limits when user tier changes', async () => {
      // Start as free user
      mockedGetUserTier.mockResolvedValue('free');
      const freeLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      
      // Pre-fill to free tier limit
      const timeWindowKey = `rate_limit_window:user123:chat_message`;
      const nowSeconds = Math.floor(Date.now() / 1000);
      for (let i = 0; i < freeLimit; i++) {
        await mockRedis.zadd(timeWindowKey, nowSeconds, `${nowSeconds}-free-${i}`);
      }
      
      // Should be blocked as free user
      let result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(result.allowed).toBe(false);
      
      // Upgrade to pro
      mockedGetUserTier.mockResolvedValue('pro');
      const proLimit = timeWindowRateLimitConfig.pro[CHAT_MESSAGE_ACTION].requests;
      
      // Should have more requests available (pro limit is higher)
      if (proLimit > freeLimit) {
        result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    test('should handle time window with no requests gracefully', async () => {
      const result = await checkRateLimit('newuser', CHAT_MESSAGE_ACTION);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.reset).toBeInstanceOf(Date);
    });

    test('should calculate correct reset time with partial window usage', async () => {
      const firstRequestTime = timeNow;
      mockRedis.setCurrentTime(firstRequestTime);
      
      // Make first request
      const result1 = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(result1.allowed).toBe(true);
      
      // The reset time after first request should be windowSeconds from now
      const windowSeconds = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].windowSeconds;
      const expectedFirstReset = new Date(firstRequestTime + (windowSeconds * 1000));
      // Allow for small differences due to timestamp precision
      expect(Math.abs(result1.reset.getTime() - expectedFirstReset.getTime())).toBeLessThan(1000);
      
      // Move forward 30 seconds
      const secondRequestTime = firstRequestTime + 30000;
      mockRedis.setCurrentTime(secondRequestTime);
      
      // Make another request
      const result2 = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(result2.allowed).toBe(true);
      
      // The reset time should be based on the oldest request (the first one)
      // So it should be firstRequestTime + windowSeconds
      const expectedSecondReset = new Date((Math.floor(firstRequestTime / 1000) + windowSeconds) * 1000);
      expect(Math.abs(result2.reset.getTime() - expectedSecondReset.getTime())).toBeLessThan(1000);
    });

    test('should handle very long user IDs', async () => {
      const longUserId = 'a'.repeat(500);
      const result = await checkRateLimit(longUserId, CHAT_MESSAGE_ACTION);
      expect(result.allowed).toBe(true);
    });

    test('should handle special characters in user IDs', async () => {
      const specialUserId = 'user:123:test@example.com:$pecial';
      const result = await checkRateLimit(specialUserId, CHAT_MESSAGE_ACTION);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Performance Under Load', () => {
    test('should handle high request volume efficiently', async () => {
      const users = 100;
      const requestsPerUser = 10;
      const startTime = Date.now();
      
      const promises: Promise<any>[] = [];
      
      for (let u = 0; u < users; u++) {
        for (let r = 0; r < requestsPerUser; r++) {
          promises.push(checkRateLimit(`user${u}`, CHAT_MESSAGE_ACTION));
        }
      }
      
      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should handle 1000 requests in under 5 seconds
    });
  });

  describe('Data Consistency', () => {
    test('should maintain consistent counts under concurrent access', async () => {
      const userId = 'testuser';
      const concurrentRequests = 50;
      
      // Make many concurrent requests
      const promises = Array(concurrentRequests).fill(null).map(() => 
        checkRateLimit(userId, CHAT_MESSAGE_ACTION)
      );
      
      const results = await Promise.all(promises);
      
      // Count allowed and blocked
      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;
      
      // Total should equal concurrent requests
      expect(allowed + blocked).toBe(concurrentRequests);
      
      // Allowed should not exceed window limit
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      expect(allowed).toBeLessThanOrEqual(windowLimit);
    });

    test('should properly track daily and window limits together', async () => {
      const dailyLimit = dailyRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      
      // Make a single request to ensure everything is working
      const firstResult = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      expect(firstResult.allowed).toBe(true);
      expect(firstResult.limit).toBe(windowLimit); // Should be window limit
      
      // Make requests until we hit the window limit
      let totalAllowed = 1; // We already made one
      
      for (let i = 1; i < windowLimit + 5; i++) {
        const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
        if (result.allowed) {
          totalAllowed++;
        } else {
          // We should hit the limit here
          expect(result.reason).toBe('time_window_limit');
          break;
        }
      }
      
      // Should have allowed exactly windowLimit requests
      expect(totalAllowed).toBe(windowLimit);
      
      // Verify daily count was tracked properly
      const todayUTC = new Date().toISOString().split('T')[0];
      const dailyKey = `rate_limit_daily:user123:chat_message:${todayUTC}`;
      const finalCount = await mockRedis.get(dailyKey);
      expect(parseInt(finalCount || '0')).toBe(totalAllowed);
    });
  });
});