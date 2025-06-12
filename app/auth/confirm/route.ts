import { createClient } from '@/lib/supabase/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  
  // Handle redirect from Supabase verification
  const redirect_to = searchParams.get('redirect_to')

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    if (!error) {
      // If there's a redirect_to from the original email, use that, otherwise use next
      const finalRedirect = redirect_to || next
      redirect(`/auth/verification-success?redirect=${encodeURIComponent(finalRedirect)}`)
    } else {
      redirect(`/auth/error?error=${error?.message}`)
    }
  }

  redirect(`/auth/error?error=No token hash or type`)
}
