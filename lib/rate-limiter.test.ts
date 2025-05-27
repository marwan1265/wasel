import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { getUserTier } from './auth/user-tier';
import {
    CHAT_MESSAGE_ACTION,
    dailyRateLimitConfig,
    timeWindowRateLimitConfig
} from './config/rate-limits';
import { checkRateLimit } from './rate-limiter';
import { getRedisClient } from './redis/config';

// Mock dependencies
jest.mock('./redis/config');
jest.mock('./auth/user-tier');

describe('Rate Limiter', () => {
  let mockRedis: any;
  let mockPipeline: any;
  let mockIncrementPipeline: any;
  const mockedGetRedisClient = getRedisClient as jest.MockedFunction<typeof getRedisClient>;
  const mockedGetUserTier = getUserTier as jest.MockedFunction<typeof getUserTier>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock pipeline for checking (first pipeline call)
    const checkPipelineFunctions: any = {
      zremrangebyscore: jest.fn(),
      zcard: jest.fn(),
      zrange: jest.fn(),
      exec: jest.fn()
    };
    
    // Make each function return the pipeline for chaining
    Object.keys(checkPipelineFunctions).forEach(key => {
      if (key !== 'exec') {
        checkPipelineFunctions[key].mockReturnValue(checkPipelineFunctions);
      }
    });
    
    // Set up exec to return the expected results for check phase
    checkPipelineFunctions.exec.mockResolvedValue([
      [null, 1], // zremrangebyscore result
      [null, 5], // zcard result (5 requests in window)
      [null, ['1234567890-abc']] // zrange result (oldest member)
    ]);
    
    mockPipeline = checkPipelineFunctions;

    // Setup mock pipeline for incrementing (second pipeline call)
    const incrementPipelineFunctions: any = {
      incr: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn()
    };
    
    // Make each function return the pipeline for chaining
    Object.keys(incrementPipelineFunctions).forEach(key => {
      if (key !== 'exec') {
        incrementPipelineFunctions[key].mockReturnValue(incrementPipelineFunctions);
      }
    });
    
    // Set up exec to return the expected results for increment phase
    incrementPipelineFunctions.exec.mockResolvedValue([
      [null, 6], // incr result
      [null, 1], // zadd result
      [null, 1], // expire result for daily key
      [null, 1], // expire result for window key
    ]);
    
    mockIncrementPipeline = incrementPipelineFunctions;

    // Setup mock Redis client with individual mocked functions
    const redisFunctions: any = {
      get: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
      pipeline: jest.fn()
    };
    
    redisFunctions.get.mockResolvedValue(null); // No existing daily count
    redisFunctions.incr.mockResolvedValue(1);
    redisFunctions.expire.mockResolvedValue(1);
    
    // Return different pipelines for check and increment phases
    let pipelineCallCount = 0;
    redisFunctions.pipeline.mockImplementation(() => {
      pipelineCallCount++;
      return pipelineCallCount === 1 ? mockPipeline : mockIncrementPipeline;
    });
    
    mockRedis = redisFunctions;

    // Setup mocked functions
    mockedGetRedisClient.mockResolvedValue(mockRedis);
    mockedGetUserTier.mockResolvedValue('free');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Daily Rate Limiting', () => {
    test('should allow requests within daily limit', async () => {
      mockRedis.get.mockResolvedValue('5'); // Current count is 5
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringMatching(/^rate_limit_daily:user123:chat_message:\d{4}-\d{2}-\d{2}$/)
      );
      expect(mockIncrementPipeline.incr).toHaveBeenCalledWith(
        expect.stringMatching(/^rate_limit_daily:user123:chat_message:\d{4}-\d{2}-\d{2}$/)
      );
    });

    test('should block requests exceeding daily limit', async () => {
      const dailyLimit = dailyRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      mockRedis.get.mockResolvedValue(String(dailyLimit)); // At the limit
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toBe('daily_limit');
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
      // Should NOT increment when blocked
      expect(mockIncrementPipeline.incr).not.toHaveBeenCalled();
    });

    test('should set expiry on first request of the day', async () => {
      mockRedis.get.mockResolvedValue(null); // No existing count
      mockIncrementPipeline.exec.mockResolvedValue([
        [null, 1], // incr result = 1 (first request)
        [null, 1], // zadd result
        [null, 1], // expire result for daily key
        [null, 1], // expire result for window key
      ]);
      
      await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(mockIncrementPipeline.expire).toHaveBeenCalledWith(
        expect.stringMatching(/^rate_limit_daily:user123:chat_message:\d{4}-\d{2}-\d{2}$/),
        expect.any(Number)
      );
    });

    test('should set expiry even on subsequent requests with new implementation', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      // New implementation always sets expiry in pipeline
      expect(mockIncrementPipeline.expire).toHaveBeenCalled();
    });

    test('should handle date boundaries correctly', async () => {
      // Test behavior near midnight UTC
      const nearMidnight = new Date();
      nearMidnight.setUTCHours(23, 59, 59, 0);
      jest.useFakeTimers().setSystemTime(nearMidnight);
      
      mockRedis.get.mockResolvedValue(null);
      
      // Mock pipeline to return timestamp near midnight
      const timestampNearMidnight = Math.floor(nearMidnight.getTime() / 1000);
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // zremrangebyscore
        [null, 1], // zcard
        [null, [`${timestampNearMidnight}-abc`]] // zrange with current timestamp
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
      expect(result.reset.getTime()).toBeGreaterThanOrEqual(nearMidnight.getTime());
      
      jest.useRealTimers();
    });
  });

  describe('Time Window Rate Limiting', () => {
    test('should allow requests within window limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // zremrangebyscore
        [null, 3], // zcard - 3 requests in window
        [null, ['1234567890-abc']] // zrange
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    test('should block requests exceeding window limit', async () => {
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // zremrangebyscore
        [null, windowLimit], // zcard - at limit
        [null, ['1234567890-abc']] // zrange
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toBe('time_window_limit');
      // Should NOT add to window when blocked
      expect(mockIncrementPipeline.zadd).not.toHaveBeenCalled();
    });

    test('should remove expired entries from window', async () => {
      await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      const nowSeconds = Math.floor(Date.now() / 1000);
      const windowSeconds = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].windowSeconds;
      const expectedMin = nowSeconds - windowSeconds;
      
      expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
        'rate_limit_window:user123:chat_message',
        0,
        expectedMin
      );
    });

    test('should calculate correct reset time from oldest request', async () => {
      const oldestTimestamp = Math.floor(Date.now() / 1000) - 1000;
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 5],
        [null, [`${oldestTimestamp}-abc`]]
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      const windowSeconds = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].windowSeconds;
      const expectedReset = new Date((oldestTimestamp + windowSeconds) * 1000);
      
      expect(result.reset.getTime()).toBe(expectedReset.getTime());
    });
  });

  describe('Combined Limits', () => {
    test('should return daily limit reason when daily limit is hit first', async () => {
      const dailyLimit = dailyRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      mockRedis.get.mockResolvedValue(String(dailyLimit)); // At daily limit
      
      // Window limit not exceeded
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, 5], // Well within window limit
        [null, ['1234567890-abc']]
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('daily_limit');
    });

    test('should return window limit reason when window limit is hit first', async () => {
      mockRedis.get.mockResolvedValue('5'); // Well within daily limit
      
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, windowLimit], // At window limit
        [null, ['1234567890-abc']]
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('time_window_limit');
    });

    test('should return minimum remaining count when both limits apply', async () => {
      const dailyLimit = dailyRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      const windowLimit = timeWindowRateLimitConfig.free[CHAT_MESSAGE_ACTION].requests;
      
      mockRedis.get.mockResolvedValue(String(dailyLimit - 10)); // 10 remaining daily
      mockPipeline.exec.mockResolvedValue([
        [null, 1],
        [null, windowLimit - 5], // 5 remaining in window
        [null, ['1234567890-abc']]
      ]);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // Minimum of 9 (10-1 after increment) and 4 (5-1 after increment)
    });
  });

  describe('User Tier Handling', () => {
    test.each(['guest', 'free', 'pro', 'unknown'] as const)(
      'should apply correct limits for %s tier',
      async (tier) => {
        mockedGetUserTier.mockResolvedValue(tier);
        
        const expectedDailyLimit = dailyRateLimitConfig[tier][CHAT_MESSAGE_ACTION].requests;
        const expectedWindowLimit = timeWindowRateLimitConfig[tier][CHAT_MESSAGE_ACTION].requests;
        
        mockRedis.get.mockResolvedValue('5');
        mockPipeline.exec.mockResolvedValue([
          [null, 1],
          [null, 5],
          [null, ['1234567890-abc']]
        ]);
        
        const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
        
        expect(result.allowed).toBe(true);
        expect(getUserTier).toHaveBeenCalledWith('user123');
        
        // Verify the limit returned matches the tier
        expect(result.limit).toBe(expectedWindowLimit);
      }
    );

    test('should handle getUserTier errors gracefully', async () => {
      mockedGetUserTier.mockRejectedValue(new Error('Database error'));
      
      // New implementation fails open
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('config_error');
      expect(result.limit).toBe(Infinity);
    });
  });

  describe('Action Type Handling', () => {
    test('should use specific action limits when available', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining(':chat_message:')
      );
    });

    test('should fall back to general API action when specific action not configured', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const result = await checkRateLimit('user123', 'unknown_action');
      
      expect(result.allowed).toBe(true);
      // Should use general API limits as fallback
    });
  });

  describe('Error Handling', () => {
    test('should fail open when Redis is unavailable', async () => {
      mockedGetRedisClient.mockRejectedValue(new Error('Redis connection failed'));
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      // New implementation fails open
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('config_error');
      expect(result.limit).toBe(Infinity);
    });

    test('should handle Redis get errors', async () => {
      mockRedis.get.mockRejectedValue(new Error('GET failed'));
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      // New implementation fails open
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('config_error');
    });

    test('should handle pipeline execution errors', async () => {
      mockPipeline.exec.mockRejectedValue(new Error('Pipeline failed'));
      mockRedis.get.mockResolvedValue('5');
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      // New implementation fails open
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('config_error');
    });

    test('should handle missing configuration gracefully', async () => {
      mockedGetUserTier.mockResolvedValue('invalid_tier' as any);
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      // Current implementation returns config_error
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('config_error');
    });

    test('should handle malformed pipeline results', async () => {
      mockPipeline.exec.mockResolvedValue([
        null, // Invalid result structure
        ['error', null], // Error in pipeline
        [null, null] // Null result
      ]);
      mockRedis.get.mockResolvedValue('5');
      
      const result = await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      
      // Should handle gracefully with defaults
      expect(result.allowed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty userId', async () => {
      await expect(checkRateLimit('', CHAT_MESSAGE_ACTION)).resolves.toBeDefined();
    });

    test('should handle very long userId', async () => {
      const longUserId = 'a'.repeat(1000);
      mockRedis.get.mockResolvedValue('1');
      
      const result = await checkRateLimit(longUserId, CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
    });

    test('should handle special characters in userId', async () => {
      const specialUserId = 'user:123:test@example.com';
      mockRedis.get.mockResolvedValue('1');
      
      const result = await checkRateLimit(specialUserId, CHAT_MESSAGE_ACTION);
      
      expect(result.allowed).toBe(true);
    });

    test('should handle concurrent requests correctly', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      // Simulate concurrent requests
      const promises = Array(10).fill(null).map(() => 
        checkRateLimit('user123', CHAT_MESSAGE_ACTION)
      );
      
      const results = await Promise.all(promises);
      
      // All should get consistent results
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });
    });
  });

  describe('Performance', () => {
    test('should complete within reasonable time', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const start = Date.now();
      await checkRateLimit('user123', CHAT_MESSAGE_ACTION);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should handle high request volume', async () => {
      mockRedis.get.mockResolvedValue('5');
      
      const requests = 1000;
      const start = Date.now();
      
      const promises = Array(requests).fill(null).map((_, i) => 
        checkRateLimit(`user${i}`, CHAT_MESSAGE_ACTION)
      );
      
      await Promise.all(promises);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000); // 1000 requests in under 5 seconds
    });
  });
}); 