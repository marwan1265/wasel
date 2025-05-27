import { getRedisClient } from '@/lib/redis/config';

/**
 * Request deduplication to prevent counting duplicate/retry requests
 * Uses a short-lived cache to track request fingerprints
 */

export interface DeduplicationOptions {
  // How long to remember a request fingerprint (in seconds)
  ttlSeconds?: number;
  // Whether to include request body in fingerprint
  includeBody?: boolean;
  // Additional custom data to include in fingerprint
  customData?: string;
}

/**
 * Generate a fingerprint for a request using Web Crypto API (Edge Runtime compatible)
 */
export async function generateRequestFingerprint(
  userId: string,
  action: string,
  requestInfo: {
    method?: string;
    path?: string;
    body?: any;
    headers?: Record<string, string>;
  },
  options: DeduplicationOptions = {}
): Promise<string> {
  const parts = [
    userId,
    action,
    requestInfo.method || 'GET',
    requestInfo.path || ''
  ];

  if (options.includeBody && requestInfo.body) {
    const bodyString = typeof requestInfo.body === 'string' 
      ? requestInfo.body 
      : JSON.stringify(requestInfo.body);
    parts.push(bodyString);
  }

  if (options.customData) {
    parts.push(options.customData);
  }

  // Create a hash of the request parts using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(parts.join('|'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert ArrayBuffer to hex string
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return hashHex;
}

/**
 * Check if a request is a duplicate
 * Returns true if this is a duplicate request that should not be counted
 */
export async function checkRequestDuplicate(
  fingerprint: string,
  options: DeduplicationOptions = {}
): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const ttl = options.ttlSeconds || 5; // Default 5 second dedup window
    const dedupKey = `rate_limit_dedup:${fingerprint}`;

    // Try to set the key with NX (only if not exists)
    const result = await redis.set(dedupKey, '1', { 
      nx: true, 
      ex: ttl 
    });

    // If result is null, the key already existed (duplicate request)
    return result === null;
  } catch (error) {
    console.error('Request deduplication error:', error);
    // On error, assume not duplicate to avoid blocking requests
    return false;
  }
}

/**
 * Mark a request as processed (for manual dedup management)
 */
export async function markRequestProcessed(
  fingerprint: string,
  ttlSeconds: number = 5
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const dedupKey = `rate_limit_dedup:${fingerprint}`;
    await redis.set(dedupKey, '1', { ex: ttlSeconds });
  } catch (error) {
    console.error('Error marking request as processed:', error);
  }
}

/**
 * Clear deduplication entry (useful for testing or manual management)
 */
export async function clearDeduplication(fingerprint: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    const dedupKey = `rate_limit_dedup:${fingerprint}`;
    await redis.del(dedupKey);
  } catch (error) {
    console.error('Error clearing deduplication:', error);
  }
} 