import { getUserTier, UserTier } from '@/lib/auth/user-tier';
import {
    dailyRateLimitConfig,
    DailyRateLimitRule,
    GENERAL_API_ACTION,
    RateLimitRule,
    timeWindowRateLimitConfig
} from '@/lib/config/rate-limits';
import { getRedisClient } from '@/lib/redis/config';
// Removed getCurrentUserId import as it's not used directly in this file

// Helper function to get seconds until the end of the current day (UTC)
function getSecondsUntilUTCEndOfDay(): number {
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, -1)); // End of current UTC day
  return Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number; // The limit that was checked (most relevant one, or window if allowed)
  remaining: number;
  reset: Date; // Approximate time when the relevant limit will reset
  retryAfterSeconds?: number;
  reason?: 'daily_limit' | 'time_window_limit' | 'config_error'; // Indicates which limit was hit
}

// Gets the rule for the user, specific to time-window limits
function getTimeWindowRuleForUser(tier: UserTier, action: string): RateLimitRule | null {
  const tierRules = timeWindowRateLimitConfig[tier];
  if (!tierRules) return null; // Should not happen if config is complete
  return tierRules[action] || tierRules[GENERAL_API_ACTION]; // Fallback to general API action rule
}

// Gets the rule for the user, specific to daily limits
function getDailyRuleForUser(tier: UserTier, action: string): DailyRateLimitRule | null {
  const tierRules = dailyRateLimitConfig[tier];
  if (!tierRules) return null; // Should not happen if config is complete
  return tierRules[action] || tierRules[GENERAL_API_ACTION]; // Fallback to general API action rule
}

export async function checkRateLimit(
  userId: string,
  action: string // e.g., 'chat_message', this should be specific to the limited resource
): Promise<RateLimitCheckResult> {
  try {
    const redis = await getRedisClient();
    const userTier = await getUserTier(userId);

    // Debug logging for troubleshooting (only in production)
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Rate limit check: userId=${userId}, action=${action}, tier=${userTier}`);
    }

    // --- Daily Limit Check (Check before increment) ---
    const dailyRule = getDailyRuleForUser(userTier, action);
    if (!dailyRule) {
      console.error(`Rate limit config error: No daily rule found for tier ${userTier}, action ${action}`);
      return { allowed: true, limit: Infinity, remaining: Infinity, reset: new Date(), reason: 'config_error' };
    }
    
    const todayUTC = new Date().toISOString().split('T')[0];
    const dailyKey = `rate_limit_daily:${userId}:${action}:${todayUTC}`;

    // First, get the current count without incrementing
    let currentDailyCount = await redis.get(dailyKey);
    let dailyCount = currentDailyCount ? parseInt(currentDailyCount, 10) : 0;

    // Check if we would exceed the daily limit
    if (dailyCount >= dailyRule.requests) {
      const endOfDayForDailyKey = new Date(Date.UTC(
        new Date().getUTCFullYear(), 
        new Date().getUTCMonth(), 
        new Date().getUTCDate() + 1, 
        0, 0, 0, -1
      ));

      return {
        allowed: false,
        limit: dailyRule.requests,
        remaining: 0,
        reset: endOfDayForDailyKey,
        retryAfterSeconds: getSecondsUntilUTCEndOfDay(),
        reason: 'daily_limit',
      };
    }

    // --- Time Window Limit Check (Check before increment) ---
    const timeWindowRule = getTimeWindowRuleForUser(userTier, action);
    if (!timeWindowRule) {
      console.error(`Rate limit config error: No time window rule found for tier ${userTier}, action ${action}`);
      return { allowed: true, limit: Infinity, remaining: Infinity, reset: new Date(), reason: 'config_error' };
    }
    
    const nowSeconds = Math.floor(Date.now() / 1000);
    const windowStartSeconds = nowSeconds - timeWindowRule.windowSeconds;
    const timeWindowKey = `rate_limit_window:${userId}:${action}`;
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Window calculation: nowSeconds=${nowSeconds}, windowSeconds=${timeWindowRule.windowSeconds}, windowStartSeconds=${windowStartSeconds}`);
      console.log(`ZREMRANGEBYSCORE will remove entries with scores between 0 and ${windowStartSeconds}`);
      
      // Sanity check for system clock issues
      const nowDate = new Date(nowSeconds * 1000);
      const currentYear = new Date().getFullYear();
      if (nowDate.getFullYear() > currentYear + 1 || nowDate.getFullYear() < currentYear - 1) {
        console.error(`WARNING: System clock appears to be incorrect. Detected year: ${nowDate.getFullYear()}, expected around: ${currentYear}`);
      }
    }

    // Use a pipeline to check the window atomically
    const pipeline = redis.pipeline();
    
    // Count current entries in window BEFORE cleanup
    pipeline.zcard(timeWindowKey);
    
    // Remove expired entries
    pipeline.zremrangebyscore(timeWindowKey, 0, windowStartSeconds);
    
    // Count current entries in window AFTER cleanup
    pipeline.zcard(timeWindowKey);
    
    // Get the oldest entry for reset time calculation
    pipeline.zrange(timeWindowKey, 0, 0);
    
    // Debug: Get all members to see what's in the set
    pipeline.zrange(timeWindowKey, 0, -1);
    
    const checkResults = await pipeline.exec() as [Error | null, any][];
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Pipeline check results:`, checkResults);
    }

    // Parse the results
    const beforeCleanupTuple = checkResults[0];
    const beforeCleanupCount = (beforeCleanupTuple && !beforeCleanupTuple[0] && typeof beforeCleanupTuple[1] === 'number') 
      ? beforeCleanupTuple[1] : 0;
      
    const zcardResultTuple = checkResults[2];
    const currentWindowCount = (zcardResultTuple && !zcardResultTuple[0] && typeof zcardResultTuple[1] === 'number') 
      ? zcardResultTuple[1] : 0;
      
    if (process.env.NODE_ENV !== 'test') {
      console.log(`AFTER cleanup - currentWindowCount: ${currentWindowCount}`);
      
      // Debug: Log all members in the sorted set
      const allMembersResult = checkResults[4];
      console.log(`Debug - checkResults[4]:`, allMembersResult);
      if (allMembersResult && !allMembersResult[0]) {
        console.log(`All members in window for ${userId}:${action}:`, allMembersResult[1]);
        // Parse and log the actual scores from member names
        const members = allMembersResult[1] as string[];
        if (members && members.length > 0) {
          const scores = members.map(member => {
            const score = parseInt(member.split('-')[0], 10);
            return { member, score, olderThanWindow: score <= windowStartSeconds };
          });
          console.log(`Parsed scores and expiry check:`, scores);
        }
      } else if (allMembersResult && allMembersResult[0]) {
        console.log(`Error getting all members:`, allMembersResult[0]);
      }
    }

    // Calculate reset time
    let windowResetTimeSeconds: number;
    const zrangeResultTuple = checkResults[3];
    const oldestRequestMembers = (zrangeResultTuple && !zrangeResultTuple[0] && Array.isArray(zrangeResultTuple[1])) 
      ? zrangeResultTuple[1] as string[] : [];
    
    if (oldestRequestMembers.length > 0 && oldestRequestMembers[0]) {
      const oldestRequestTimestamp = parseInt(oldestRequestMembers[0].split('-')[0], 10);
      windowResetTimeSeconds = oldestRequestTimestamp + timeWindowRule.windowSeconds;
    } else {
      windowResetTimeSeconds = nowSeconds + timeWindowRule.windowSeconds;
    }

    // Check if we would exceed the window limit (use count after cleanup)
    if (currentWindowCount >= timeWindowRule.requests) {
      if (process.env.NODE_ENV !== 'test') {
      console.log(`Window limit exceeded: userId=${userId}, action=${action}, currentCount=${currentWindowCount}, limit=${timeWindowRule.requests}`);
    }
      const retryAfter = Math.max(0, windowResetTimeSeconds - nowSeconds);
      return {
        allowed: false,
        limit: timeWindowRule.requests,
        remaining: 0,
        reset: new Date(windowResetTimeSeconds * 1000),
        retryAfterSeconds: retryAfter,
        reason: 'time_window_limit',
      };
    }

    // --- Request is allowed, now increment counters atomically ---
    
    // Increment daily counter with atomic operation
    const incrementPipeline = redis.pipeline();
    
    // Increment daily counter
    incrementPipeline.incr(dailyKey);
    
    // Add entry to time window
    const uniqueMember = `${nowSeconds}-${Math.random().toString(36).substring(2, 15)}`;
    incrementPipeline.zadd(timeWindowKey, nowSeconds, uniqueMember);
    
    // Set expiries
    incrementPipeline.expire(dailyKey, getSecondsUntilUTCEndOfDay());
    incrementPipeline.expire(timeWindowKey, timeWindowRule.windowSeconds + 60);
    
    const incrementResults = await incrementPipeline.exec() as [Error | null, any][];
    
    // Debug log the increment results (only in production)
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Increment pipeline results:`, incrementResults);
    }
    
    // Get the new daily count from the increment result
    const incrResultTuple = incrementResults[0];
    const newDailyCount = (incrResultTuple && !incrResultTuple[0] && typeof incrResultTuple[1] === 'number')
      ? incrResultTuple[1] : dailyCount + 1;
      
    // Check if zadd succeeded
    const zaddResultTuple = incrementResults[1];
    if (zaddResultTuple && zaddResultTuple[0]) {
      console.error(`ZADD error:`, zaddResultTuple[0]);
    }
    
    // Calculate the actual window count after increment
    const actualWindowCount = currentWindowCount + 1;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`After increment - actualWindowCount: ${actualWindowCount}, previousCount: ${currentWindowCount}`);
    }

    // Calculate remaining requests (minimum of both limits)
    const dailyRemaining = Math.max(0, dailyRule.requests - newDailyCount);
    const windowRemaining = Math.max(0, timeWindowRule.requests - actualWindowCount);
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Request allowed: userId=${userId}, action=${action}, dailyCount=${newDailyCount}/${dailyRule.requests}, windowCount=${actualWindowCount}/${timeWindowRule.requests}, remaining=${Math.min(dailyRemaining, windowRemaining)}`);
    }
    
    return {
      allowed: true,
      limit: timeWindowRule.requests, // Report the window limit as it's the more frequent one
      remaining: Math.min(dailyRemaining, windowRemaining),
      reset: new Date(windowResetTimeSeconds * 1000),
    };
    
  } catch (error) {
    console.error('Rate limiting error:', error);
    // Fail open on errors - allow the request but log the issue
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: new Date(),
      reason: 'config_error'
    };
  }
} 