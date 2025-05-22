import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export type UserTierInfo = {
  tier: 'guest' | 'free' | 'pro' | 'unknown'
  isGuest: boolean
  isUnknown: boolean
  isFree: boolean
  isPro: boolean
}

export const useUserTier = () => {
  const [userTierInfo, setUserTierInfo] = useState<UserTierInfo>({
    tier: 'unknown',
    isGuest: false,
    isUnknown: true,
    isFree: false,
    isPro: false
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    const fetchUserTier = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/user/tier')
        if (!response.ok) {
          console.error('Failed to fetch user tier')
          return
        }

        const data = await response.json()
        setUserTierInfo(data)
      } catch (error) {
        console.error('Error fetching user tier:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Initial fetch
    fetchUserTier()

    // Listen for auth state changes and refetch tier when user logs in/out
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, 'Session exists:', !!session)
        // Refetch user tier when auth state changes
        await fetchUserTier()
      }
    )

    // Cleanup listener on unmount
    return () => {
      authListener?.subscription?.unsubscribe()
    }
  }, [])

  return { ...userTierInfo, isLoading }
} 