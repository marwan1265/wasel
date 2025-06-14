'use client'

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function VerifyOTPPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') || ''
  const type = searchParams.get('type') || 'signup'
  
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // Countdown for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length !== 6) {
      setError('يرجى إدخال رمز مكون من 6 أرقام')
      return
    }

    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: type as 'signup' | 'email_change' | 'recovery'
      })

      if (error) throw error

      // Success - redirect to verification success
      router.push('/auth/verification-success')
    } catch (error: unknown) {
      let errorMessage = 'رمز التحقق غير صحيح'
      
      if (error instanceof Error) {
        const message = error.message.toLowerCase()
        
        // Handle specific OTP error cases
        if (message.includes('token has expired') || message.includes('expired')) {
          errorMessage = 'انتهت صلاحية الرمز. يرجى طلب رمز جديد'
        } else if (message.includes('invalid') || message.includes('incorrect')) {
          errorMessage = 'رمز التحقق غير صحيح. يرجى المحاولة مرة أخرى'
        } else if (message.includes('too many attempts')) {
          errorMessage = 'تم تجاوز عدد المحاولات المسموحة. يرجى المحاولة لاحقاً'
        } else {
          errorMessage = error.message
        }
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setIsResending(true)
    setError(null)

    try {
      const response = await fetch('/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          captchaToken: 'bypass-for-resend' // Note: Consider adding CAPTCHA here too
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'فشل في إرسال رمز جديد')
      }

      // Start cooldown
      setResendCooldown(60)
      setError('تم إرسال رمز جديد إلى بريدك الإلكتروني')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'فشل في إرسال رمز جديد')
    } finally {
      setIsResending(false)
    }
  }

  if (!email) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-center text-red-600">خطأ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm">البريد الإلكتروني مفقود</p>
            <div className="mt-4 text-center">
              <Link href="/auth/sign-up">
                <Button variant="outline">العودة للتسجيل</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">تحقق من بريدك الإلكتروني</CardTitle>
            <CardDescription className="text-center">
              أدخل الرمز المكون من 6 أرقام المرسل إلى<br />
              <strong>{email}</strong>
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                الرمز صالح لمدة 10 دقائق
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">رمز التحقق</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtp(value)
                  }}
                  disabled={isLoading}
                  className="text-center text-2xl tracking-widest"
                  maxLength={6}
                  autoComplete="one-time-code"
                />
              </div>

              {error && (
                <div className="text-center">
                  <p className={`text-sm ${
                    error.includes('تم إرسال') ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {error}
                  </p>
                  {error.includes('انتهت صلاحية') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      👇 اضغط 'إرسال رمز جديد' للحصول على رمز جديد
                    </p>
                  )}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? 'جاري التحقق...' : 'تأكيد الرمز'}
              </Button>

              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  لم تستلم الرمز؟
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOTP}
                  disabled={isResending || resendCooldown > 0}
                  className="w-full"
                >
                  {isResending ? 'جاري الإرسال...' : 
                   resendCooldown > 0 ? `إعادة الإرسال (${resendCooldown}s)` : 
                   'إرسال رمز جديد'}
                </Button>
              </div>

              <div className="text-center text-sm">
                <Link href="/auth/sign-up" className="text-muted-foreground hover:underline">
                  ← العودة للتسجيل
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 