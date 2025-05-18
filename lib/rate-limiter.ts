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
  const redis = await getRedisClient();
  const userTier = await getUserTier(userId);

  // --- Daily Limit Check ---
  const dailyRule = getDailyRuleForUser(userTier, action);
  if (!dailyRule) {
    console.error(`Rate limit config error: No daily rule found for tier ${userTier}, action ${action}`);
    return { allowed: true, limit: Infinity, remaining: Infinity, reset: new Date(), reason: 'config_error' }; // Fail open on config error
  }
  const todayUTC = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
  const dailyKey = `rate_limit_daily:${userId}:${action}:${todayUTC}`;

  const dailyCountResult = await redis.incr(dailyKey);
  const dailyCount = typeof dailyCountResult === 'number' ? dailyCountResult : 0;

  if (dailyCount === 1) { // First request for this user, action, day
    await redis.expire(dailyKey, getSecondsUntilUTCEndOfDay());
  }

  if (dailyCount > dailyRule.requests) {
    const resetTime = new Date();
    resetTime.setUTCHours(23, 59, 59, 999); // End of current UTC day
    const now = new Date();
    // Adjust resetTime to be start of next UTC day if current time is past midnight for the key's date definition
    const endOfDayForDailyKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, -1));

    return {
      allowed: false,
      limit: dailyRule.requests,
      remaining: 0,
      reset: endOfDayForDailyKey, 
      retryAfterSeconds: getSecondsUntilUTCEndOfDay(),
      reason: 'daily_limit',
    };
  }
  const dailyRemaining = dailyRule.requests - dailyCount;

  // --- Time Window Limit Check ---
  const timeWindowRule = getTimeWindowRuleForUser(userTier, action);
  if (!timeWindowRule) {
    console.error(`Rate limit config error: No time window rule found for tier ${userTier}, action ${action}`);
    return { allowed: true, limit: Infinity, remaining: Infinity, reset: new Date(), reason: 'config_error' }; // Fail open on config error
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const windowStartSeconds = nowSeconds - timeWindowRule.windowSeconds;
  const timeWindowKey = `rate_limit_window:${userId}:${action}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(timeWindowKey, 0, windowStartSeconds);
  const uniqueMember = `${nowSeconds}-${Math.random().toString(36).substring(2, 15)}`;
  pipeline.zadd(timeWindowKey, nowSeconds, uniqueMember);
  pipeline.zcard(timeWindowKey);
  pipeline.expire(timeWindowKey, timeWindowRule.windowSeconds + 60);
  pipeline.zrange(timeWindowKey, 0, 0); // Oldest request for reset calculation
  
  // Each result in the array is a tuple: [Error | null, resultValue]
  const results = await pipeline.exec() as [Error | null, any][];

  const zcardResultTuple = results[2]; // zcard is the 3rd command in pipeline
  const currentWindowCount = (zcardResultTuple && !zcardResultTuple[0] && typeof zcardResultTuple[1] === 'number') ? zcardResultTuple[1] : 0;

  let windowResetTimeSeconds: number;
  const zrangeResultTuple = results[4]; // zrange is the 5th command
  const oldestRequestMembers = (zrangeResultTuple && !zrangeResultTuple[0] && Array.isArray(zrangeResultTuple[1])) ? zrangeResultTuple[1] as string[] : [];
  
  if (oldestRequestMembers.length > 0 && oldestRequestMembers[0]) {
    const oldestRequestTimestamp = parseInt(oldestRequestMembers[0].split('-')[0], 10);
    windowResetTimeSeconds = oldestRequestTimestamp + timeWindowRule.windowSeconds;
  } else {
    windowResetTimeSeconds = nowSeconds + timeWindowRule.windowSeconds;
  }

  if (currentWindowCount > timeWindowRule.requests) {
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

  // If both limits passed
  return {
    allowed: true,
    limit: timeWindowRule.requests, // Report the window limit as it's the more frequent one
    remaining: Math.min(dailyRemaining, timeWindowRule.requests - currentWindowCount),
    reset: new Date(windowResetTimeSeconds * 1000), // Report window reset
  };
} 