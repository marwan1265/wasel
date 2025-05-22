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
    const fetchUserTier = async () => {
      try {
        const response = await fetch('/api/user/tier')
        if (!response.ok) {
          console.error('Failed to fetch user tier')
          setIsLoading(false)
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

    fetchUserTier()
  }, [])

  return { ...userTierInfo, isLoading }
} 