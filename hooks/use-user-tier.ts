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
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setUserTierInfo(session.user.user_metadata.tier)
        }
      }
    })

    // Cleanup listener on unmount
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  return { ...userTierInfo, isLoading }
} 