import { type NextRequest, NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // The final redirect should be to the home page, which will trigger a
      // server-side render and pick up the new session. A hard refresh
      // is implicitly handled by this server-to-client navigation.
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = next
      redirectUrl.searchParams.delete('code') // Don't expose the code in the final URL
      
      // In development, you might need to specify the full origin.
      // In production, the forwarded host should be used.
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      let finalRedirectUrl: URL;
      if (isLocalEnv) {
        finalRedirectUrl = new URL(next, origin)
      } else if (forwardedHost) {
        finalRedirectUrl = new URL(next, `https://${forwardedHost}`)
      } else {
        finalRedirectUrl = new URL(next, origin)
      }

      return NextResponse.redirect(finalRedirectUrl)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/error`)
}
