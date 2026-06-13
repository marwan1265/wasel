'use client'

import { AuthProvider } from '@/lib/contexts/auth-context'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { SessionInitializer } from './session-initializer'

const SESSION_ANONYMOUS_ATTEMPTED_KEY = 'morphic_anonymous_signIn_attempted'

export function SessionInitializerWithContext({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showTurnstile, setShowTurnstile] = useState(false)
  const [isAuthPending, setIsAuthPending] = useState(false)
  const [isAuthSuccessful, setIsAuthSuccessful] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    const checkUserSession = async () => {
      setIsLoading(true)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        setIsLoading(false)
        // If we can't get session and haven't attempted anon sign-in, we'll need to show Turnstile
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
          setShowTurnstile(true)
          setIsAuthPending(true)
          setIsAuthSuccessful(false)
          setAuthError(null)
        } else {
          // Session error and already attempted - mark as failed
          setIsAuthPending(false)
          setIsAuthSuccessful(false)
          setAuthError(sessionError.message)
        }
        return
      }

      if (session?.user) {
        setCurrentUser(session.user)
        sessionStorage.removeItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)
        setIsLoading(false)
        setIsAuthPending(false)
        setIsAuthSuccessful(true)
        setAuthError(null)
      } else {
        // No active session, check if we've already tried anonymous sign-in
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
          setShowTurnstile(true)
          setIsAuthPending(true)
          setIsAuthSuccessful(false)
          setAuthError(null)
        } else {
          setIsAuthPending(false)
          setIsAuthSuccessful(false)
          setAuthError('Anonymous sign-in was attempted but no session exists')
        }
        setIsLoading(false)
      }
    }

    // Turnstile is optional: when no site key is configured, the inner
    // SessionInitializer performs a tokenless anonymous sign-in. We still run
    // checkUserSession here so this context resolves once that session exists.

    checkUserSession()
    
    // Listen to auth changes to update state
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null)
      if (session?.user) {
        sessionStorage.removeItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)
        setIsAuthPending(false)
        setIsAuthSuccessful(true)
        setAuthError(null)
        setShowTurnstile(false)
      } else {
        // If user becomes null (e.g. logout) and we haven't attempted anon in this session
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
          // Don't automatically re-show turnstile on logout to prevent loops
        }
      }
      
      // When a user signs in or out, the server-side session changes.
      // router.refresh() tells Next.js to re-fetch Server Components,
      // which will then have the new, correct session information.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Clear sidebar state cookie on sign out to prevent layout issues
        if (event === 'SIGNED_OUT') {
          document.cookie = 'sidebar_state=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
        }
        router.refresh()
      }
    })

    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [supabase, turnstileSiteKey, router])

  // Listen for auth completion events from SessionInitializer
  useEffect(() => {
    const handleAuthComplete = (event: CustomEvent) => {
      const { success, error, user } = event.detail
      
      setIsAuthPending(false)
      setShowTurnstile(false)
      setIsAuthSuccessful(success)
      setAuthError(error)
      
      if (success && user) {
        setCurrentUser(user)
      } else if (!success) {
        setCurrentUser(null)
      }
    }

    // Listen for the enhanced auth-complete event
    window.addEventListener('auth-complete', handleAuthComplete as EventListener)
    
    return () => {
      window.removeEventListener('auth-complete', handleAuthComplete as EventListener)
    }
  }, [setCurrentUser, setShowTurnstile, setIsAuthPending, setIsAuthSuccessful, setAuthError])

  const authContextValue = {
    isAuthReady: !isLoading && !isAuthPending,
    isAuthPending: isAuthPending || (isLoading && showTurnstile),
    isAuthSuccessful,
    authError,
    user: currentUser
  }

  return (
    <AuthProvider value={authContextValue}>
      <SessionInitializer />
      {children}
    </AuthProvider>
  )
} 