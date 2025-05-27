import { checkRateLimit } from '@/lib/rate-limiter'
import { checkRequestDuplicate, generateRequestFingerprint } from '@/lib/rate-limiter-dedup'
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api/auth/callback (Supabase auth callback)
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. /_vercel (Vercel internals) 
     * 5. Static files (e.g. /favicon.ico, /sitemap.xml, /robots.txt, etc.)
     */
    '/((?!api/auth/callback|_next|_static|_vercel|[\\w-]+\\.\\w+).*)',
  ],
}

// Helper function to determine the action based on the request
function getActionFromRequest(pathname: string, method: string): string {
  // Only POST requests to /api/chat (exactly) are chat messages
  if (pathname === '/api/chat' && method === 'POST') {
    return 'chat_message';
  }
  // Default to general API access for other endpoints
  return 'general_api_access';
}

// Helper function to create supabase client
function createSupabaseClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        }
      }
    }
  )

  return { supabase, response: supabaseResponse }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const start = Date.now()

  // Skip rate limiting for health checks
  if (pathname === '/api/health') {
    return NextResponse.next()
  }

  // Update user's auth tokens if needed
  try {
    const { supabase, response } = createSupabaseClient(request)
    const { data: { user } } = await supabase.auth.getUser()

    // For protected routes, check if user is authenticated
    if (!user && pathname.startsWith('/api/') && pathname !== '/api/auth/callback') {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401, 
          headers: { 
            'content-type': 'application/json',
            'x-middleware-cache': 'no-cache'
          }
        }
      )
    }

    // Apply rate limiting only to API routes
    if (pathname.startsWith('/api/') && pathname !== '/api/auth/callback') {
      const userId = user?.id || 'anonymous'
      const action = getActionFromRequest(pathname, request.method)
      
      // Generate request fingerprint for deduplication
      const fingerprint = generateRequestFingerprint(
        userId,
        action,
        {
          method: request.method,
          path: pathname,
          // For chat messages, include a portion of the body for deduplication
          body: action === 'chat_message' && request.method === 'POST' 
            ? await request.clone().text().then(text => text.substring(0, 100))
            : undefined
        },
        {
          ttlSeconds: 5, // 5 second deduplication window
          includeBody: action === 'chat_message'
        }
      )

      // Check if this is a duplicate request
      const isDuplicate = await checkRequestDuplicate(fingerprint)
      
      if (isDuplicate) {
        console.log(`Duplicate request detected for ${userId}:${action}, skipping rate limit`)
        // Allow duplicate requests through without counting against rate limit
        return response
      }

      // Check rate limit
      const rateLimitResult = await checkRateLimit(userId, action)

      // Add rate limit headers to response
      const rateLimitHeaders = {
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toISOString(),
        'X-RateLimit-Policy': rateLimitResult.reason || 'standard'
      }

      // Clone response and add headers
      const modifiedResponse = NextResponse.next({
        request: {
          headers: request.headers,
        },
      })

      // Copy all headers from the original response
      response.headers.forEach((value: string, key: string) => {
        modifiedResponse.headers.set(key, value)
      })

      // Add rate limit headers
      Object.entries(rateLimitHeaders).forEach(([key, value]) => {
        modifiedResponse.headers.set(key, value)
      })

      if (!rateLimitResult.allowed) {
        // Log rate limit exceeded
        console.log(`Rate limit exceeded for ${userId}:${action}`, {
          userId,
          action,
          reason: rateLimitResult.reason,
          limit: rateLimitResult.limit,
          reset: rateLimitResult.reset.toISOString(),
          path: pathname,
          method: request.method,
          duration: Date.now() - start
        })

        const errorMessage = rateLimitResult.reason === 'daily_limit' 
          ? `Daily limit exceeded. Please try again after ${rateLimitResult.reset.toLocaleString()}.`
          : `Too many requests. Please try again in ${rateLimitResult.retryAfterSeconds} seconds.`

        return new NextResponse(
          JSON.stringify({ 
            error: 'Too Many Requests',
            message: errorMessage,
            retryAfter: rateLimitResult.retryAfterSeconds,
            reset: rateLimitResult.reset.toISOString()
          }),
          { 
            status: 429,
            headers: {
              'content-type': 'application/json',
              'Retry-After': rateLimitResult.retryAfterSeconds?.toString() || '60',
              ...rateLimitHeaders
            }
          }
        )
      }

      // Log successful request in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`Request allowed for ${userId}:${action}`, {
          remaining: rateLimitResult.remaining,
          limit: rateLimitResult.limit,
          duration: Date.now() - start
        })
      }

      return modifiedResponse
    }

    return response
  } catch (error) {
    console.error('Middleware error:', error)
    
    // On error, fail open - allow the request but log the issue
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }
}
