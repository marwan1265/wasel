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
  const [isPolling, setIsPolling] = useState(true)

  // Listen for auth state changes and poll for email verification status
  useEffect(() => {
    if (!email || !isPolling) return

    console.log('Starting verification polling for email:', email)
    const supabase = createClient()
    let pollInterval: NodeJS.Timeout

    const checkVerificationStatus = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Error checking user status:', error)
          return
        }

        console.log('Checking user verification status:', {
          userExists: !!user,
          emailConfirmed: user?.email_confirmed_at,
          email: user?.email
        })

        // Check if user exists and email is confirmed - redirect immediately
        if (user && user.email_confirmed_at) {
          console.log('User verified! Redirecting to verification success...')
          setIsPolling(false)
          router.push('/auth/verification-success')
          router.refresh()
        }
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
        
        if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
          console.log('Sign in detected with verified email! Redirecting...')
          setIsPolling(false)
          router.push('/auth/verification-success')
          router.refresh()
        }
      }
    )

    // Check immediately
    checkVerificationStatus()

    // Then check every 3 seconds as backup
    pollInterval = setInterval(checkVerificationStatus, 3000)

    // Stop polling after 10 minutes to prevent indefinite polling
    const stopPollingTimeout = setTimeout(() => {
      console.log('Stopping verification polling after 10 minutes')
      setIsPolling(false)
    }, 10 * 60 * 1000) // 10 minutes

    return () => {
      if (pollInterval) clearInterval(pollInterval)
      if (stopPollingTimeout) clearTimeout(stopPollingTimeout)
      subscription.unsubscribe()
    }
  }, [email, isPolling, router])

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
