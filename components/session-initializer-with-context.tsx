'use client'

import { AuthProvider } from '@/lib/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const MAX_SIGN_IN_ATTEMPTS = 3

type AuthStatus = 'checking' | 'pending' | 'success' | 'error'

export function SessionInitializerWithContext({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [authError, setAuthError] = useState<string | null>(null)
  // Whether the (invisible) Turnstile widget should be mounted
  const [signInNeeded, setSignInNeeded] = useState(false)
  // Cloudflare decided it needs user interaction; the chat composer surfaces
  // the widget inline when a message is waiting to send
  const [verificationRequired, setVerificationRequired] = useState(false)
  // DOM node inside the chat composer that hosts the widget, when present
  const [verificationSlot, setVerificationSlot] = useState<HTMLElement | null>(
    null
  )

  const turnstileRef = useRef<TurnstileInstance | null>(null)
  const signInAttemptsRef = useRef(0)
  const widgetErrorsRef = useRef(0)
  const signingInRef = useRef(false)

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const markSuccess = useCallback((user: User) => {
    setCurrentUser(user)
    setStatus('success')
    setAuthError(null)
    setSignInNeeded(false)
    setVerificationRequired(false)
  }, [])

  // Sign-in path when Turnstile is configured: called with each fresh token.
  // Captcha tokens are single-use, so a failed attempt resets the widget to
  // obtain a new token, which re-invokes this via onSuccess.
  const signInWithToken = useCallback(
    async (token: string) => {
      if (signingInRef.current) return
      signingInRef.current = true
      signInAttemptsRef.current += 1
      try {
        const { data, error } = await supabase.auth.signInAnonymously({
          options: { captchaToken: token }
        })
        if (error || !data?.user) {
          throw new Error(error?.message ?? 'No user returned from sign-in')
        }
        markSuccess(data.user)
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Unknown error during sign-in'
        if (signInAttemptsRef.current < MAX_SIGN_IN_ATTEMPTS) {
          turnstileRef.current?.reset()
        } else {
          setStatus('error')
          setAuthError(message)
          setSignInNeeded(false)
          setVerificationRequired(false)
        }
      } finally {
        signingInRef.current = false
      }
    },
    [supabase, markSuccess]
  )

  // Sign-in path without Turnstile (local/self-host): retry with backoff.
  const signInTokenless = useCallback(async () => {
    if (signingInRef.current) return
    signingInRef.current = true
    try {
      let lastError = 'Unknown error during sign-in'
      for (let attempt = 1; attempt <= MAX_SIGN_IN_ATTEMPTS; attempt++) {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (!error && data?.user) {
          markSuccess(data.user)
          return
        }
        lastError = error?.message ?? 'No user returned from sign-in'
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      }
      setStatus('error')
      setAuthError(lastError)
    } finally {
      signingInRef.current = false
    }
  }, [supabase, markSuccess])

  const handleWidgetError = useCallback(() => {
    widgetErrorsRef.current += 1
    if (widgetErrorsRef.current < MAX_SIGN_IN_ATTEMPTS) {
      setTimeout(() => turnstileRef.current?.reset(), 1000)
    } else {
      setStatus('error')
      setAuthError('Verification challenge failed')
      setSignInNeeded(false)
      setVerificationRequired(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (session?.user) {
        markSuccess(session.user)
        return
      }

      // No session (or failed to read one): sign in anonymously in the
      // background. With Turnstile configured the invisible widget produces a
      // token via onSuccess; without it we sign in tokenless directly.
      setStatus('pending')
      if (turnstileSiteKey) {
        setSignInNeeded(true)
      } else {
        signInTokenless()
      }
    }

    init()

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setCurrentUser(session?.user ?? null)
        if (session?.user) {
          markSuccess(session.user)
        }

        // When a user signs in or out, the server-side session changes.
        // router.refresh() tells Next.js to re-fetch Server Components,
        // which will then have the new, correct session information.
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          // Clear sidebar state cookie on sign out to prevent layout issues
          if (event === 'SIGNED_OUT') {
            document.cookie =
              'sidebar_state=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          }
          router.refresh()
        }
      }
    )

    return () => {
      cancelled = true
      authListener?.subscription?.unsubscribe()
    }
  }, [supabase, turnstileSiteKey, router, markSuccess, signInTokenless])

  const authContextValue = {
    isAuthReady: status === 'success' || status === 'error',
    isAuthPending: status === 'checking' || status === 'pending',
    isAuthSuccessful: status === 'success',
    authError,
    user: currentUser,
    verificationRequired,
    registerVerificationSlot: setVerificationSlot
  }

  // The widget runs invisibly (interaction-only). When a chat composer has
  // registered a slot it lives there, so that on the rare occasion Cloudflare
  // requires interaction it surfaces inline in the composer; otherwise it is
  // parked in an off-layout container where the invisible flow still runs.
  const turnstileWidget =
    signInNeeded && turnstileSiteKey ? (
      <Turnstile
        ref={turnstileRef}
        siteKey={turnstileSiteKey}
        onSuccess={signInWithToken}
        onError={handleWidgetError}
        onExpire={() => turnstileRef.current?.reset()}
        onBeforeInteractive={() => setVerificationRequired(true)}
        options={{ appearance: 'interaction-only', theme: 'auto' }}
      />
    ) : null

  return (
    <AuthProvider value={authContextValue}>
      {turnstileWidget &&
        (verificationSlot ? (
          createPortal(turnstileWidget, verificationSlot)
        ) : (
          <div className="fixed bottom-0 end-0 invisible">
            {turnstileWidget}
          </div>
        ))}
      {children}
    </AuthProvider>
  )
}
