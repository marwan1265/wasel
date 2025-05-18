import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export const useCurrentUserId = () => {
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient() // Create client once

  useEffect(() => {
    // Function to set user ID from session
    const updateUserState = (session: any) => { // Use 'any' for session to match Supabase examples if specific type is unknown
      setUserId(session?.user?.id ?? null)
    }

    // Initial check for session
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateUserState(session)
    }).catch(error => {
      console.error('Error fetching initial session:', error)
      setUserId(null)
    })

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateUserState(session)
      }
    )

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [supabase]) // Add supabase as a dependency

  return userId
} 