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
        console.error("Error fetching session:", sessionError)
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
        console.log('User session found:', session.user.id)
        sessionStorage.removeItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)
        setIsLoading(false)
        setIsAuthPending(false)
        setIsAuthSuccessful(true)
        setAuthError(null)
      } else {
        // No active session, check if we've already tried anonymous sign-in
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
          console.log('No active session, preparing for anonymous sign-in.')
          setShowTurnstile(true)
          setIsAuthPending(true)
          setIsAuthSuccessful(false)
          setAuthError(null)
        } else {
          console.log('Anonymous sign-in already attempted in this session.')
          setIsAuthPending(false)
          setIsAuthSuccessful(false)
          setAuthError('Anonymous sign-in was attempted but no session exists')
        }
        setIsLoading(false)
      }
    }

    if (!turnstileSiteKey) {
      console.error('Turnstile site key is not configured. Cannot attempt anonymous sign-in.')
      setIsLoading(false)
      setIsAuthPending(false)
      setIsAuthSuccessful(false)
      setAuthError('Turnstile site key not configured')
      return
    }

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
      
      console.log('Auth complete event received:', { success, error, user: user?.id })
      
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
  }, [])

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