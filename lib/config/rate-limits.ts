import { UserTier } from '@/lib/auth/user-tier';

export interface RateLimitRule {
  requests: number; // Max requests
  windowSeconds: number; // Time window in seconds
}

export interface DailyRateLimitRule {
  requests: number; // Max requests per day
}

// --- Action Names ---
export const CHAT_MESSAGE_ACTION = 'chat_message';
export const GENERAL_API_ACTION = 'general_api_access'; // For history, delete, share etc.

// Time-Window-Based Limits
export const timeWindowRateLimitConfig: Record<UserTier, Record<string, RateLimitRule>> = {
  guest: {
    [CHAT_MESSAGE_ACTION]: { requests: 10, windowSeconds: 3 * 60 * 60 },  // 10 messages per 3 hours
    [GENERAL_API_ACTION]: { requests: 1000, windowSeconds: 1 * 60 * 60 }, // 1000 general API calls per hour
  },
  free: {
    [CHAT_MESSAGE_ACTION]: { requests: 50, windowSeconds: 3 * 60 * 60 },   // 50 messages per 3 hours
    [GENERAL_API_ACTION]: { requests: 2000, windowSeconds: 1 * 60 * 60 },
  },
  pro: {
    [CHAT_MESSAGE_ACTION]: { requests: 150, windowSeconds: 3 * 60 * 60 },  // 150 messages per 3 hours
    [GENERAL_API_ACTION]: { requests: 5000, windowSeconds: 1 * 60 * 60 },
  },
  unknown: { // Fallback, aligned with guest
    [CHAT_MESSAGE_ACTION]: { requests: 10, windowSeconds: 3 * 60 * 60 },
    [GENERAL_API_ACTION]: { requests: 1000, windowSeconds: 1 * 60 * 60 },
  },
};

// Daily Limits (primarily for messages, but can be action-specific)
export const dailyRateLimitConfig: Record<UserTier, Record<string, DailyRateLimitRule>> = {
  guest: {
    [CHAT_MESSAGE_ACTION]: { requests: 80 },   // 80 messages/day
    [GENERAL_API_ACTION]: { requests: 5000 }, // 5000 general API calls/day
  },
  free: {
    [CHAT_MESSAGE_ACTION]: { requests: 400 },  // 400 messages/day
    [GENERAL_API_ACTION]: { requests: 10000 },
  },
  pro: {
    [CHAT_MESSAGE_ACTION]: { requests: 1200 }, // 1200 messages/day
    [GENERAL_API_ACTION]: { requests: 20000 },
  },
  unknown: { // Fallback, aligned with guest
    [CHAT_MESSAGE_ACTION]: { requests: 80 },
    [GENERAL_API_ACTION]: { requests: 5000 },
  },
};

// Commented out old example
// // Example for action-specific limits (optional, can be expanded later)
// // export const actionSpecificRateLimits: Record<string, Partial<Record<UserTier, RateLimitRule>>> = {
// //   '/api/chat': {
// //     guest: { requests: 5, windowSeconds: 60 },
// //   },
// // }; 