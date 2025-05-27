// Lua scripts for atomic rate limiting operations

// Check and increment rate limit atomically
// Keys: [1] = daily key, [2] = window key
// Args: [1] = daily limit, [2] = window limit, [3] = current timestamp (seconds), 
//       [4] = window duration (seconds), [5] = daily TTL (seconds)
export const CHECK_AND_INCREMENT_SCRIPT = `
  local daily_key = KEYS[1]
  local window_key = KEYS[2]
  local daily_limit = tonumber(ARGV[1])
  local window_limit = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local window_duration = tonumber(ARGV[4])
  local daily_ttl = tonumber(ARGV[5])
  
  -- Check daily limit
  local daily_count = redis.call('GET', daily_key)
  if daily_count and tonumber(daily_count) >= daily_limit then
    return {0, 'daily_limit', daily_limit, 0, daily_ttl}
  end
  
  -- Clean up expired entries from window
  local window_start = now - window_duration
  redis.call('ZREMRANGEBYSCORE', window_key, 0, window_start)
  
  -- Check window limit
  local window_count = redis.call('ZCARD', window_key)
  if window_count >= window_limit then
    -- Get oldest entry for reset time calculation
    local oldest = redis.call('ZRANGE', window_key, 0, 0, 'WITHSCORES')
    local reset_time = window_duration
    if oldest[2] then
      reset_time = tonumber(oldest[2]) + window_duration - now
    end
    return {0, 'window_limit', window_limit, 0, reset_time}
  end
  
  -- Request is allowed - increment counters
  local new_daily_count = redis.call('INCR', daily_key)
  if new_daily_count == 1 then
    redis.call('EXPIRE', daily_key, daily_ttl)
  end
  
  -- Add to window
  local unique_id = now .. '-' .. math.random()
  redis.call('ZADD', window_key, now, unique_id)
  redis.call('EXPIRE', window_key, window_duration + 60)
  
  -- Calculate remaining
  local daily_remaining = math.max(0, daily_limit - new_daily_count)
  local window_remaining = math.max(0, window_limit - window_count - 1)
  local remaining = math.min(daily_remaining, window_remaining)
  
  -- Get reset time
  local oldest_in_window = redis.call('ZRANGE', window_key, 0, 0, 'WITHSCORES')
  local window_reset = window_duration
  if oldest_in_window[2] then
    window_reset = tonumber(oldest_in_window[2]) + window_duration - now
  end
  
  return {1, 'allowed', window_limit, remaining, window_reset}
`;

// Get current counts without incrementing
// Keys: [1] = daily key, [2] = window key
// Args: [1] = daily limit, [2] = window limit, [3] = current timestamp (seconds), 
//       [4] = window duration (seconds)
export const GET_CURRENT_USAGE_SCRIPT = `
  local daily_key = KEYS[1]
  local window_key = KEYS[2]
  local daily_limit = tonumber(ARGV[1])
  local window_limit = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local window_duration = tonumber(ARGV[4])
  
  -- Get daily count
  local daily_count = redis.call('GET', daily_key) or 0
  daily_count = tonumber(daily_count)
  
  -- Clean up expired entries from window
  local window_start = now - window_duration
  redis.call('ZREMRANGEBYSCORE', window_key, 0, window_start)
  
  -- Get window count
  local window_count = redis.call('ZCARD', window_key)
  
  -- Calculate remaining
  local daily_remaining = math.max(0, daily_limit - daily_count)
  local window_remaining = math.max(0, window_limit - window_count)
  local remaining = math.min(daily_remaining, window_remaining)
  
  -- Get reset times
  local daily_ttl = redis.call('TTL', daily_key)
  if daily_ttl < 0 then daily_ttl = 86400 end -- Default to 24 hours
  
  local oldest_in_window = redis.call('ZRANGE', window_key, 0, 0, 'WITHSCORES')
  local window_reset = window_duration
  if oldest_in_window[2] then
    window_reset = tonumber(oldest_in_window[2]) + window_duration - now
  end
  
  return {daily_count, window_count, daily_remaining, window_remaining, remaining, daily_ttl, window_reset}
`; 