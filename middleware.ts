import { getCurrentUserId } from '@/lib/auth/get-current-user';
import { CHAT_MESSAGE_ACTION, GENERAL_API_ACTION } from '@/lib/config/rate-limits'; // Import action constants
import { checkRateLimit } from '@/lib/rate-limiter';
import { getRedisClient } from '@/lib/redis/config'; // Import Redis client
import { NextRequest, NextResponse } from 'next/server';

// Specify which paths should be rate-limited
export const config = {
  matcher: [
    '/api/:path*', // All API routes
    // Add other paths if needed, e.g., specific pages doing heavy server actions
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Example: Exclude specific non-critical API routes if necessary
  // if (pathname.startsWith('/api/healthcheck')) {
  //   return NextResponse.next();
  // }

  try {
    const userId = await getCurrentUserId(); 
    console.log('[Middleware] Rate Limiting. Path:', pathname, 'Method:', request.method, 'UserID:', userId); // Temporary log

    let action: string;
    // Specifically identify chat message submissions
    if (pathname.startsWith('/api/chat') && request.method === 'POST') { 
      action = CHAT_MESSAGE_ACTION;
    } else if (pathname.startsWith('/api/chats') && request.method === 'GET') { // History view
      action = GENERAL_API_ACTION;
    } else if (pathname.startsWith('/api/chat/') && request.method === 'DELETE') { // Deleting a chat
      action = GENERAL_API_ACTION;
    } else if (pathname.startsWith('/api/share/')) { // Sharing related endpoints
      action = GENERAL_API_ACTION;
    } else {
      // For any other /api routes not explicitly handled, use general action.
      // Consider if some of these might need specific, more restrictive limits too.
      action = GENERAL_API_ACTION; 
    }

    // ---- Block CHAT_MESSAGE_ACTION for users who failed anonymous sign-in ----
    if (userId === 'anonymous' && action === CHAT_MESSAGE_ACTION) {
      console.log(
        `[Middleware] Blocking CHAT_MESSAGE_ACTION for unauthenticated user (ID: 'anonymous'), Path: ${pathname}`
      );
      return new NextResponse(
        JSON.stringify({
          error: 'Authentication Required',
          message: 'You must be signed in to send messages.',
        }),
        { status: 403 } // 403 Forbidden is more appropriate than 429 here
      );
    }
    // ---- End Block ----

    // ---- Enhanced Logging for Guest Chat Messages (successful anonymous sign-in) ----
    // This log now only applies to users with actual Supabase anonymous UUIDs who are classified as 'guest' tier
    // OR if you decide to still log for userId === 'anonymous' for GENERAL_API_ACTION (but they can't send messages)
    if (userId === 'anonymous' && action === CHAT_MESSAGE_ACTION) { // This block is now effectively dead code due to the check above, but keep for structure or if logic changes.
      // Retaining the logging structure in case the blocking logic above is altered or for other specific 'anonymous' actions.
      const redis = await getRedisClient();
      const timeWindowKey = `rate_limit_window:${userId}:${action}`;
      const currentWindowCount = await redis.zcard(timeWindowKey);
      const todayUTC = new Date().toISOString().split('T')[0];
      const dailyKey = `rate_limit_daily:${userId}:${action}:${todayUTC}`;
      const currentDailyCount = await redis.get(dailyKey);
      console.log(
        `[Middleware] Logging for user ('${userId}') - Action: ${action}, Path: ${pathname}, ` +
        `Window Count (zcard): ${currentWindowCount}, Daily Count (get): ${currentDailyCount || '0'}`
      );
    } else {
      console.log('[Middleware] Rate Limiting. Path:', pathname, 'Method:', request.method, 'UserID:', userId, 'Action:', action);
    }
    // ---- End Enhanced Logging ----

    const result = await checkRateLimit(userId, action);
    
    // Prepare headers for the outgoing response (whether it's a 429 or a 200 from the actual route)
    const responseHeaders = new Headers();
    responseHeaders.set('X-RateLimit-Limit', result.limit.toString());
    responseHeaders.set('X-RateLimit-Remaining', result.remaining.toString());
    responseHeaders.set('X-RateLimit-Reset', Math.floor(result.reset.getTime() / 1000).toString());

    if (!result.allowed) {
      // result.retryAfterSeconds should be set by checkRateLimit if not allowed
      const retryAfter = result.retryAfterSeconds ?? 60; // Fallback to 60s 

      responseHeaders.set('Retry-After', retryAfter.toString());
      
      const responseBody = JSON.stringify({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Action: ${action}, Reason: ${result.reason || 'general'}. Try again in ${retryAfter} seconds.`,
      });
      return new NextResponse(responseBody, {
        status: 429,
        headers: responseHeaders,
      });
    }
    
    // If allowed, pass the request to the next handler and attach rate limit headers to the response.
    // NextResponse.next() creates a new response, so we need to pass our headers to it.
    const response = NextResponse.next({
      request: {
        headers: request.headers, // Pass original request headers through
      },
    });

    // Append our rate limit headers to the response that will go to the client.
    responseHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;

  } catch (error) {
    console.error('Error in rate limiting middleware:', error);
    // Fail open in case of unexpected errors in the rate limiter itself
    // Or, return a generic server error response
    // For now, failing open by calling NextResponse.next()
    return NextResponse.next(); 
  }
}
