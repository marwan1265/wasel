'use client'

import { Button } from '@/components/ui/button'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card'
import { AppleIcon, GoogleIcon, IconLogo } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/index'
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const router = useRouter()

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const resetTurnstile = () => {
    setTurnstileToken(null)
    if (turnstileRef.current) {
      turnstileRef.current.reset()
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password !== repeatPassword) {
      setError('كلمات المرور غير متطابقة')
      setIsLoading(false)
      return
    }

    if (!turnstileToken) {
      setError('يرجى إكمال تحدي التحقق من الهوية.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken: turnstileToken
        }
      })
      if (error) throw error
      // Redirect to OTP verification page instead
      router.push(`/auth/verify-otp?email=${encodeURIComponent(email)}&type=signup`)
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'حدث خطأ ما')
      // Reset Turnstile token after failed attempt to prevent duplicate errors
      resetTurnstile()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/oauth`
        }
      })
      if (error) throw error
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'حدث خطأ في تسجيل الدخول الاجتماعي'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!turnstileSiteKey) {
    console.error('Turnstile site key is not configured.')
    return (
      <div className="text-red-500 text-center p-4">
        إعدادات التحقق من الهوية مفقودة. يرجى التواصل مع الدعم الفني.
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-col items-center gap-6', className)}
      {...props}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex flex-col items-center justify-center gap-4">
            <IconLogo className="size-12" />
            إنشاء حساب جديد
          </CardTitle>
          <CardDescription>
            أدخل بياناتك أدناه للبدء
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              سجل باستخدام Google
            </Button>

            <Button
              type="button"
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={() => handleSocialLogin('apple')}
              disabled={isLoading}
            >
              <AppleIcon className="mr-2 h-4 w-4" />
              سجل باستخدام Apple
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-muted px-2 text-muted-foreground">أو</span>
              </div>
            </div>

            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">كلمة المرور</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="********"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">تأكيد كلمة المرور</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  placeholder="********"
                  required
                  value={repeatPassword}
                  onChange={e => setRepeatPassword(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="my-4 flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey}
                  onSuccess={setTurnstileToken}
                  onError={() => {
                    setError('فشل التحقق من الهوية. يرجى المحاولة مرة أخرى.')
                    setTurnstileToken(null)
                  }}
                  onExpire={() => {
                    setError('انتهت صلاحية التحقق من الهوية. يرجى إكماله مرة أخرى.')
                    setTurnstileToken(null)
                  }}
                  options={{
                    theme: 'light',
                    appearance: 'always'
                  }}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading || !turnstileToken}>
                {isLoading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
              </Button>
            </form>
          </div>
          <div className="mt-6 text-center text-sm">
            لديك حساب بالفعل؟{' '}
            <Link href="/auth/login" className="underline underline-offset-4">
              تسجيل الدخول
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          &larr; العودة للرئيسية
        </Link>
      </div>
    </div>
  )
}
