import { getUserTier, UserTier } from '@/lib/auth/user-tier';
import {
    dailyRateLimitConfig,
    DailyRateLimitRule,
    GENERAL_API_ACTION,
    RateLimitRule,
    timeWindowRateLimitConfig
} from '@/lib/config/rate-limits';
import { getRedisClient } from '@/lib/redis/config';
import { CHECK_AND_INCREMENT_SCRIPT, GET_CURRENT_USAGE_SCRIPT } from './rate-limiter-lua';

// Helper function to get seconds until the end of the current day (UTC)
function getSecondsUntilUTCEndOfDay(): number {
  const now = new Date();
  const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, -1));
  return Math.floor((endOfDay.getTime() - now.getTime()) / 1000);
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfterSeconds?: number;
  reason?: 'daily_limit' | 'time_window_limit' | 'config_error';
}

// Gets the rule for the user, specific to time-window limits
function getTimeWindowRuleForUser(tier: UserTier, action: string): RateLimitRule | null {
  const tierRules = timeWindowRateLimitConfig[tier];
  if (!tierRules) return null;
  return tierRules[action] || tierRules[GENERAL_API_ACTION];
}

// Gets the rule for the user, specific to daily limits
function getDailyRuleForUser(tier: UserTier, action: string): DailyRateLimitRule | null {
  const tierRules = dailyRateLimitConfig[tier];
  if (!tierRules) return null;
  return tierRules[action] || tierRules[GENERAL_API_ACTION];
}

/**
 * Atomic rate limit check using Lua script
 * This ensures all operations are atomic and prevents race conditions
 */
export async function checkRateLimitAtomic(
  userId: string,
  action: string
): Promise<RateLimitCheckResult> {
  try {
    const redis = await getRedisClient();
    const userTier = await getUserTier(userId);

    // Get rate limit rules
    const dailyRule = getDailyRuleForUser(userTier, action);
    const timeWindowRule = getTimeWindowRuleForUser(userTier, action);

    if (!dailyRule || !timeWindowRule) {
      console.error(`Rate limit config error: Missing rules for tier ${userTier}, action ${action}`);
      return { 
        allowed: true, 
        limit: Infinity, 
        remaining: Infinity, 
        reset: new Date(), 
        reason: 'config_error' 
      };
    }

    // Prepare keys and arguments
    const todayUTC = new Date().toISOString().split('T')[0];
    const dailyKey = `rate_limit_daily:${userId}:${action}:${todayUTC}`;
    const timeWindowKey = `rate_limit_window:${userId}:${action}`;
    
    const nowSeconds = Math.floor(Date.now() / 1000);
    const dailyTTL = getSecondsUntilUTCEndOfDay();

    // Execute the atomic rate limit check
    const result = await redis.eval(
      CHECK_AND_INCREMENT_SCRIPT,
      [dailyKey, timeWindowKey],
      [
        dailyRule.requests,
        timeWindowRule.requests,
        nowSeconds,
        timeWindowRule.windowSeconds,
        dailyTTL
      ]
    ) as [number, string, number, number, number];

    const [allowed, reason, limit, remaining, resetSeconds] = result;

    // Calculate reset date based on the reason
    let resetDate: Date;
    if (reason === 'daily_limit') {
      resetDate = new Date(Date.UTC(
        new Date().getUTCFullYear(), 
        new Date().getUTCMonth(), 
        new Date().getUTCDate() + 1, 
        0, 0, 0, -1
      ));
    } else {
      resetDate = new Date((nowSeconds + resetSeconds) * 1000);
    }

    return {
      allowed: allowed === 1,
      limit,
      remaining,
      reset: resetDate,
      retryAfterSeconds: allowed === 0 ? resetSeconds : undefined,
      reason: allowed === 0 ? (reason as 'daily_limit' | 'time_window_limit') : undefined
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

/**
 * Get current usage without incrementing (for informational purposes)
 */
export async function getCurrentUsage(
  userId: string,
  action: string
): Promise<{
  dailyUsed: number;
  windowUsed: number;
  dailyRemaining: number;
  windowRemaining: number;
  totalRemaining: number;
  dailyResetSeconds: number;
  windowResetSeconds: number;
}> {
  try {
    const redis = await getRedisClient();
    const userTier = await getUserTier(userId);

    // Get rate limit rules
    const dailyRule = getDailyRuleForUser(userTier, action);
    const timeWindowRule = getTimeWindowRuleForUser(userTier, action);

    if (!dailyRule || !timeWindowRule) {
      console.error(`Rate limit config error: Missing rules for tier ${userTier}, action ${action}`);
      return {
        dailyUsed: 0,
        windowUsed: 0,
        dailyRemaining: Infinity,
        windowRemaining: Infinity,
        totalRemaining: Infinity,
        dailyResetSeconds: 0,
        windowResetSeconds: 0
      };
    }

    // Prepare keys and arguments
    const todayUTC = new Date().toISOString().split('T')[0];
    const dailyKey = `rate_limit_daily:${userId}:${action}:${todayUTC}`;
    const timeWindowKey = `rate_limit_window:${userId}:${action}`;
    
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Execute the usage check
    const result = await redis.eval(
      GET_CURRENT_USAGE_SCRIPT,
      [dailyKey, timeWindowKey],
      [
        dailyRule.requests,
        timeWindowRule.requests,
        nowSeconds,
        timeWindowRule.windowSeconds
      ]
    ) as [number, number, number, number, number, number, number];

    const [
      dailyUsed,
      windowUsed,
      dailyRemaining,
      windowRemaining,
      totalRemaining,
      dailyResetSeconds,
      windowResetSeconds
    ] = result;

    return {
      dailyUsed,
      windowUsed,
      dailyRemaining,
      windowRemaining,
      totalRemaining,
      dailyResetSeconds,
      windowResetSeconds
    };

  } catch (error) {
    console.error('Error getting current usage:', error);
    return {
      dailyUsed: 0,
      windowUsed: 0,
      dailyRemaining: Infinity,
      windowRemaining: Infinity,
      totalRemaining: Infinity,
      dailyResetSeconds: 0,
      windowResetSeconds: 0
    };
  }
} 