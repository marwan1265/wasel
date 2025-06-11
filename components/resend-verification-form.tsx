'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile'
import { useEffect, useRef, useState } from 'react'

interface ResendVerificationFormProps {
  initialEmail?: string
  onSuccess?: () => void
  onError?: (error: string) => void
  className?: string
}

export function ResendVerificationForm({
  initialEmail = '',
  onSuccess,
  onError,
  className = ''
}: ResendVerificationFormProps) {
  const [email, setEmail] = useState(initialEmail)
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const resetTurnstile = () => {
    setTurnstileToken(null)
    if (turnstileRef.current) {
      turnstileRef.current.reset()
    }
  }

  // Countdown effect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const handleResendVerification = async () => {
    if (!email.trim()) {
      const error = 'يرجى إدخال عنوان البريد الإلكتروني'
      setResendError(error)
      onError?.(error)
      return
    }

    if (!turnstileToken) {
      setResendError('Please complete the CAPTCHA challenge.')
      onError?.('Please complete the CAPTCHA challenge.')
      return
    }

    setIsResending(true)
    setResendError(null)
    setResendSuccess(false)

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          captchaToken: turnstileToken
        }
      })

      if (error) throw error

      setResendSuccess(true)
      setCountdown(60) // Start 60-second countdown
      onSuccess?.()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ في إرسال البريد الإلكتروني'
      setResendError(errorMessage)
      onError?.(errorMessage)
      // Reset Turnstile token after failed attempt
      resetTurnstile()
    } finally {
      setIsResending(false)
    }
  }

  const isButtonDisabled = isResending || !email.trim() || countdown > 0 || !turnstileToken

  if (!turnstileSiteKey) {
    return (
      <div className="text-center p-2 text-red-600 text-sm">
        CAPTCHA configuration is missing. Please contact support.
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="resend-email" className="text-sm font-medium text-black">
          لم تتلق البريد الإلكتروني؟
        </Label>
        <Input
          id="resend-email"
          type="email"
          placeholder="بريدك الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isResending}
          readOnly={!!initialEmail}
          className="bg-white border-gray-300 focus:border-primary focus:ring-primary text-black"
        />
      </div>

      <div className="flex justify-center">
        <Turnstile
          ref={turnstileRef}
          siteKey={turnstileSiteKey}
          onSuccess={setTurnstileToken}
          onError={() => {
            setTurnstileToken(null)
            setResendError('CAPTCHA verification failed. Please try again.')
          }}
          onExpire={() => {
            setTurnstileToken(null)
            setResendError('CAPTCHA expired. Please complete it again.')
          }}
        />
      </div>
      
      {countdown > 0 && (
        <div className="text-center">
          <p className="text-sm text-black font-medium">
            يمكنك إعادة الإرسال خلال {countdown} ثانية
          </p>
        </div>
      )}
      
      <Button
        onClick={handleResendVerification}
        disabled={isButtonDisabled}
        variant="outline"
        className="w-full transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:border-primary disabled:opacity-50 disabled:cursor-not-allowed bg-white border-gray-300 text-black"
      >
        {isResending ? (
          <div className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            جاري الإرسال...
          </div>
        ) : countdown > 0 ? (
          `إعادة الإرسال متاحة خلال ${countdown} ثانية`
        ) : (
          'إعادة إرسال رسالة التأكيد'
        )}
      </Button>
      
      {resendSuccess && countdown === 0 && (
        <div className="text-center">
          <p className="text-sm text-green-600 font-medium">
            تم إرسال رسالة التأكيد بنجاح! تحقق من بريدك الإلكتروني.
          </p>
        </div>
      )}
      
      {resendError && (
        <div className="text-center">
          <p className="text-sm text-red-600 font-medium">
            {resendError}
          </p>
        </div>
      )}
    </div>
  )
} 