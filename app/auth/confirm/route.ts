import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // Supabase automatically handles email verification when user clicks the link
  // We just need to verify that the user is actually verified before redirecting
  
  const supabase = await createClient()

  try {
    // Check if user is authenticated and verified
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      console.error('Error getting user during confirmation:', error)
      redirect('/auth/sign-in?error=verification_failed')
      return
    }

    if (!user) {
      console.error('No user found during email confirmation')
      redirect('/auth/sign-in?error=no_user_found')
      return
    }

    if (!user.email_confirmed_at) {
      console.error('User email not confirmed - link may be expired or invalid')
      redirect('/auth/sign-in?error=email_not_confirmed')
      return
    }

    // Success - user is verified, redirect to verification success page
    console.log('Email verification confirmed for user:', user.email)
    redirect('/auth/verification-success')
    
  } catch (error) {
    console.error('Unexpected error during email confirmation check:', error)
    redirect('/auth/sign-in?error=verification_failed')
  }
}
