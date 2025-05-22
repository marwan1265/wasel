import { getCurrentUserId } from '@/lib/auth/get-current-user';
import { getUserTier } from '@/lib/auth/user-tier';
import { CHAT_MESSAGE_ACTION, GENERAL_API_ACTION } from '@/lib/config/rate-limits'; // Import action constants
import { checkRateLimit } from '@/lib/rate-limiter';
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

    // ---- Block CHAT_MESSAGE_ACTION for unauthenticated and unknown users ----
    if (action === CHAT_MESSAGE_ACTION) {
      const userTier = await getUserTier(userId);
      
      if (userId === 'anonymous' || userTier === 'unknown') {
        console.log(
          `[Middleware] Blocking CHAT_MESSAGE_ACTION for unauthorized user (ID: '${userId}', Tier: '${userTier}'), Path: ${pathname}`
        );
        return new NextResponse(
          JSON.stringify({
            error: 'Authentication Required',
            message: 'You must be signed in to send messages.',
          }),
          { status: 403 } // 403 Forbidden is more appropriate than 429 here
        );
      }
    }
    // ---- End Block ----

    // ---- Standard Logging ----
    console.log('[Middleware] Rate Limiting. Path:', pathname, 'Method:', request.method, 'UserID:', userId, 'Action:', action);
    // ---- End Logging ----

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
