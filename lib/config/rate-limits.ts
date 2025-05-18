import { UserTier } from '@/lib/auth/user-tier';

export interface RateLimitRule {
  requests: number; // Max requests
  windowSeconds: number; // Time window in seconds
}

// Time-Window-Based Limits (e.g., Messages Every 3 Hours)
export const timeWindowRateLimitConfig: Record<UserTier, RateLimitRule> = {
  guest: { requests: 10, windowSeconds: 3 * 60 * 60 },  // 10 requests per 3 hours
  free: { requests: 50, windowSeconds: 3 * 60 * 60 },   // 50 requests per 3 hours
  pro: { requests: 150, windowSeconds: 3 * 60 * 60 },  // 150 requests per 3 hours
  unknown: { requests: 10, windowSeconds: 3 * 60 * 60 }, // Fallback, aligned with guest
};

export interface DailyRateLimitRule {
  requests: number; // Max requests per day
}

// Daily Message Limits
export const dailyRateLimitConfig: Record<UserTier, DailyRateLimitRule> = {
  guest: { requests: 80 },   // 80 messages/day
  free: { requests: 400 },  // 400 messages/day
  pro: { requests: 1200 }, // 1200 messages/day
  unknown: { requests: 80 }, // Fallback, aligned with guest
};

// Example for action-specific limits (optional, can be expanded later)
// export const actionSpecificRateLimits: Record<string, Partial<Record<UserTier, RateLimitRule>>> = {
//   '/api/chat': {
//     guest: { requests: 5, windowSeconds: 60 },
//   },
// }; 