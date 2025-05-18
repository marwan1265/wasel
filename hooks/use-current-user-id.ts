import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export const useCurrentUserId = () => {
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const fetchUserId = async () => {
      const { data, error } = await createClient().auth.getSession()
      if (error) {
        console.error('Error fetching user session:', error)
        setUserId(null) // Or handle appropriately
        return
      }

      setUserId(data.session?.user.id ?? null)
    }

    fetchUserId()
  }, [])

  return userId
} 