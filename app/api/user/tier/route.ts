import { getCurrentUserId } from '@/lib/auth/get-current-user';
import { getUserTier } from '@/lib/auth/user-tier';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    
    // Basic validation
    if (!userId) {
      return NextResponse.json({ 
        tier: 'unknown',
        isGuest: false,
        isUnknown: true,
        isFree: false,
        isPro: false
      }, { status: 401 })
    }

    const tier = await getUserTier(userId)
    
    return NextResponse.json({ 
      tier,
      isGuest: tier === 'guest',
      isUnknown: tier === 'unknown',
      isFree: tier === 'free',
      isPro: tier === 'pro'
    })
  } catch (error) {
    console.error('Error fetching user tier:', error)
    return NextResponse.json({ 
      tier: 'unknown',
      isGuest: false,
      isUnknown: true,
      isFree: false,
      isPro: false
    }, { status: 500 })
  }
} 