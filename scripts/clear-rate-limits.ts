#!/usr/bin/env node

/**
 * Script to clear rate limit data from Redis
 * 
 * Usage:
 * 1. Set environment variables:
 *    export UPSTASH_REDIS_REST_URL=your_redis_url
 *    export UPSTASH_REDIS_REST_TOKEN=your_redis_token
 * 
 * 2. Run the script:
 *    npx tsx scripts/clear-rate-limits.ts
 * 
 * Or use with .env.local file:
 *    npx dotenv -e .env.local -- tsx scripts/clear-rate-limits.ts
 */

import { getRedisClient } from '../lib/redis/config';

async function clearRateLimits() {
  console.log('Connecting to Redis...');
  const redis = await getRedisClient();
  
  try {
    // Since Upstash Redis doesn't have scan method on the wrapper,
    // we need to use the underlying client
    const client = (redis as any).client;
    
    // Scan for all rate limit keys
    console.log('Scanning for rate limit keys...');
    let cursor = "0";
    let totalDeleted = 0;
    
    do {
      // Scan for keys matching rate limit patterns
      const [nextCursor, keys] = await client.scan(cursor, {
        match: 'rate_limit_*',
        count: 100
      });
      
      cursor = nextCursor;
      
      if (keys.length > 0) {
        console.log(`Found ${keys.length} rate limit keys`);
        
        // Delete the keys one by one or in batches
        for (const key of keys) {
          const deleted = await redis.del(key);
          totalDeleted += deleted;
        }
        console.log(`Deleted ${keys.length} keys`);
      }
      
    } while (cursor !== "0");
    
    console.log(`\nTotal rate limit keys deleted: ${totalDeleted}`);
    
    // Also clear any deduplication keys
    console.log('\nScanning for deduplication keys...');
    cursor = "0";
    let dedupDeleted = 0;
    
    do {
      const [nextCursor, keys] = await client.scan(cursor, {
        match: 'rate_limit_dedup:*',
        count: 100
      });
      
      cursor = nextCursor;
      
      if (keys.length > 0) {
        console.log(`Found ${keys.length} deduplication keys`);
        for (const key of keys) {
          const deleted = await redis.del(key);
          dedupDeleted += deleted;
        }
        console.log(`Deleted ${keys.length} keys`);
      }
      
    } while (cursor !== "0");
    
    console.log(`Total deduplication keys deleted: ${dedupDeleted}`);
    console.log('\nRate limit data cleared successfully!');
    
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the cleanup
clearRateLimits(); 