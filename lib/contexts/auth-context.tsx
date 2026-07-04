'use client'

import { User } from '@supabase/supabase-js'
import { createContext, ReactNode, useContext } from 'react'

interface AuthContextType {
  isAuthReady: boolean
  isAuthPending: boolean
  isAuthSuccessful: boolean
  authError: string | null
  user: User | null
  /** Cloudflare decided the invisible check needs user interaction */
  verificationRequired: boolean
  /** Registers the DOM node that hosts the verification widget inline (chat composer) */
  registerVerificationSlot: (el: HTMLElement | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ 
  children, 
  value 
}: { 
  children: ReactNode
  value: AuthContextType 
}) {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
} 