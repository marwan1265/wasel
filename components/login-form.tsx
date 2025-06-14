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
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const router = useRouter()

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const messageParam = searchParams.get('message')

    if (emailParam) {
      setEmail(emailParam)
    }
    if (messageParam === 'verification_successful') {
      setSuccessMessage('تم تأكيد بريدك الإلكتروني بنجاح! يرجى تسجيل الدخول للمتابعة.')
    }
  }, [searchParams])

  const resetTurnstile = () => {
    setTurnstileToken(null)
    if (turnstileRef.current) {
      turnstileRef.current.reset()
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA challenge.')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: {
          captchaToken: turnstileToken
        }
      })
      if (error) throw error
      // Redirect to root and refresh to ensure server components get updated session
      router.push('/')
      router.refresh()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
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

    // Note: Turnstile is typically not used for OAuth redirects directly in the same way.
    // Supabase handles captcha on the OAuth provider's page if configured on Supabase side.
    // If you enabled captcha for social logins in Supabase, this part might need specific handling
    // if Supabase expects a token even for the initiation of OAuth.
    // For now, we assume captcha is primarily for email/password flows.

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/oauth`
          // captchaToken: turnstileToken, // Usually not needed here, but check Supabase docs if captcha for social is enabled
        }
      })
      if (error) throw error
    } catch (error: unknown) {
      setError(
        error instanceof Error ? error.message : 'An OAuth error occurred'
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (!turnstileSiteKey) {
    console.error('Turnstile site key is not configured.')
    return (
      <div className="text-red-500 text-center p-4">
        CAPTCHA configuration is missing. Please contact support.
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
            مرحباً بعودتك
          </CardTitle>
          <CardDescription>تسجيل الدخول إلى حسابك</CardDescription>
        </CardHeader>
        <CardContent>
          {successMessage && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-center text-sm text-green-700">
              <p>{successMessage}</p>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={() => handleSocialLogin('google')}
              disabled={isLoading}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              سجل الدخول مع Google
            </Button>

            <Button
              type="button"
              className="w-full bg-black text-white hover:bg-gray-800"
              onClick={() => handleSocialLogin('apple')}
              disabled={isLoading}
            >
              <AppleIcon className="mr-2 h-4 w-4" />
              سجل الدخول مع Apple
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-muted px-2 text-muted-foreground">أو</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
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
                  <Link
                    href="/auth/forgot-password"
                    className="mr-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    نسيت كلمة المرور؟
                  </Link>
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

              <div className="my-4 flex justify-center">
                <Turnstile
                  ref={turnstileRef}
                  siteKey={turnstileSiteKey}
                  onSuccess={setTurnstileToken}
                  onError={() => {
                    setError('CAPTCHA verification failed. Please try again.')
                    setTurnstileToken(null)
                  }}
                  onExpire={() => {
                    setError('CAPTCHA expired. Please complete it again.')
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
                {isLoading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
              </Button>
            </form>
          </div>
          <div className="mt-6 text-center text-sm">
            ليس لديك حساب؟{' '}
            <Link href="/auth/sign-up" className="underline underline-offset-4">
              التسجيل
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:underline">
          &larr; العودة إلى الصفحة الرئيسية
        </Link>
      </div>
    </div>
  )
}
