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

    const supabase = createClient()
    let pollInterval: NodeJS.Timeout

    const checkVerificationStatus = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
          console.error('Error checking user status:', error)
          return
        }

        // Check if user exists and email is confirmed - redirect immediately
        if (user && user.email_confirmed_at) {
          setIsPolling(false)
          router.push('/')
          router.refresh()
        }
      } catch (error) {
        console.error('Error during verification check:', error)
      }
    }

    // Listen for auth state changes (for immediate detection)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
          setIsPolling(false)
          router.push('/')
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
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">شكراً لك على التسجيل!</CardTitle>
              <CardDescription>تحقق من بريدك الإلكتروني للتأكيد</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                لقد تم تسجيلك بنجاح. يرجى التحقق من بريدك الإلكتروني لتأكيد حسابك
                قبل تسجيل الدخول.
              </p>
              
              {isPolling && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center text-sm text-muted-foreground">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    في انتظار التحقق من البريد الإلكتروني...
                  </div>
                </div>
              )}
              
              <ResendVerificationForm initialEmail={email} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
