'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

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

  const handleResendVerification = async () => {
    if (!email.trim()) {
      const error = 'يرجى إدخال عنوان البريد الإلكتروني'
      setResendError(error)
      onError?.(error)
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
        }
      })

      if (error) throw error

      setResendSuccess(true)
      onSuccess?.()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ في إرسال البريد الإلكتروني'
      setResendError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="resend-email">
          لم تتلق البريد الإلكتروني؟
        </Label>
        <Input
          id="resend-email"
          type="email"
          placeholder="أدخل بريدك الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isResending}
        />
      </div>
      
      <Button
        onClick={handleResendVerification}
        disabled={isResending || !email.trim()}
        variant="outline"
        className="w-full"
      >
        {isResending ? 'جاري الإرسال...' : 'إعادة إرسال رسالة التأكيد'}
      </Button>
      
      {resendSuccess && (
        <p className="text-sm text-green-600 text-center">
          تم إرسال رسالة التأكيد بنجاح! تحقق من بريدك الإلكتروني.
        </p>
      )}
      
      {resendError && (
        <p className="text-sm text-red-600 text-center">
          {resendError}
        </p>
      )}
    </div>
  )
} 