import { getCurrentUser, getCurrentUserId } from '@/lib/auth/get-current-user';
import { getUserTier } from '@/lib/auth/user-tier';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = await getCurrentUserId();
    const userTier = await getUserTier(userId);
    
    // Also try to get user via supabase client
    const supabase = await createClient();
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    
    return NextResponse.json({
      user: {
        id: user?.id,
        email: user?.email,
        is_anonymous: user?.is_anonymous,
        user_metadata: user?.user_metadata,
        app_metadata: user?.app_metadata
      },
      supabaseUser: {
        id: supabaseUser?.id,
        email: supabaseUser?.email,
        is_anonymous: supabaseUser?.is_anonymous,
        user_metadata: supabaseUser?.user_metadata,
        app_metadata: supabaseUser?.app_metadata
      },
      userId,
      userTier,
      debug: {
        userExists: !!user,
        supabaseUserExists: !!supabaseUser,
        userIdValid: !!userId && userId !== 'anonymous'
      }
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({ 
      error: 'Failed to get debug info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 