'use client'

import { ResendVerificationForm } from '@/components/resend-verification-form'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') || ''
  const [isVerified, setIsVerified] = useState(false)

  // Listen for auth state changes and poll for email verification status
  useEffect(() => {
    if (!email || isVerified) return

    console.log('Starting verification polling for email:', email)
    const supabase = createClient()
    let pollInterval: NodeJS.Timeout
    let stopPollingTimeout: NodeJS.Timeout

    const redirectToSuccess = () => {
      console.log('Redirecting to verification success page...')
      setIsVerified(true)
      router.push('/auth/verification-success')
    }

    const checkVerificationStatus = async (source = 'polling') => {
      try {
        console.log(`Checking verification status (${source})...`)
        
        // Always refresh session to get the latest data
        const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshError) {
          console.log('Session refresh error:', refreshError.message)
          // Try getUser as fallback
          const { data: userData, error: getUserError } = await supabase.auth.getUser()
          if (getUserError) {
            console.error('Error getting user:', getUserError)
            return
          }
          
          if (userData.user?.email_confirmed_at) {
            console.log('User verified via getUser fallback!')
            redirectToSuccess()
            return
          }
        } else if (sessionData?.session?.user?.email_confirmed_at) {
          console.log('User verified via session refresh!')
          redirectToSuccess()
          return
        }

        console.log('User not yet verified, continuing to poll...')
      } catch (error) {
        console.error('Error during verification check:', error)
      }
    }

    // Listen for auth state changes (for immediate detection)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change detected:', {
          event,
          userExists: !!session?.user,
          emailConfirmed: session?.user?.email_confirmed_at
        })
        
        // Check for email verification on any auth state change
        if (session?.user?.email_confirmed_at && !isVerified) {
          console.log('Email verification detected via auth state change!')
          redirectToSuccess()
        }
      }
    )

    // Check immediately on page load
    checkVerificationStatus('initial')

    // Start continuous polling every 3 seconds
    pollInterval = setInterval(() => checkVerificationStatus('interval'), 3000)

    // Check verification when user focuses back on the tab/window
    const handleFocus = () => {
      if (!isVerified) {
        checkVerificationStatus('focus')
      }
    }
    
    window.addEventListener('focus', handleFocus)

    // Stop polling after 15 minutes to prevent indefinite polling
    stopPollingTimeout = setTimeout(() => {
      console.log('Stopping verification polling after 15 minutes')
      clearInterval(pollInterval)
    }, 15 * 60 * 1000) // 15 minutes

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (stopPollingTimeout) clearTimeout(stopPollingTimeout)
      window.removeEventListener('focus', handleFocus)
      subscription.unsubscribe()
    }
  }, [email, router, isVerified])

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card className="border-0 shadow-none">
            <CardHeader>
              <CardTitle className="text-2xl text-black">شكراً لك على التسجيل!</CardTitle>
              <CardDescription className="text-black">تحقق من بريدك الإلكتروني للتأكيد</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-black">
                لقد تم تسجيلك بنجاح. يرجى التحقق من بريدك الإلكتروني لتأكيد حسابك
                قبل تسجيل الدخول.
              </p>
              
              <ResendVerificationForm initialEmail={email} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
