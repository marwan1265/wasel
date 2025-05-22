'use server'

import { getCurrentUser } from '@/lib/auth/get-current-user';
import { createClient as createSupabaseClient } from '@/lib/supabase/server';

export type UserTier = 'guest' | 'free' | 'pro' | 'unknown';

export async function getUserTier(userId: string): Promise<UserTier> {
  if (!userId || userId === 'anonymous') { // Treat literal 'anonymous' string as invalid/unknown userId
    return 'unknown';
  }

  try {
    const supabase = await createSupabaseClient();

    // First, get the current user to check if they are anonymous
    const user = await getCurrentUser();
    
    if (!user || user.id !== userId) {
      return 'unknown';
    }

    // Check if user is anonymous directly from the user object
    if (user.is_anonymous === true) {
      return 'guest';
    }

    // User is NOT anonymous, check for a corresponding profile for data integrity.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id') // We only need to check for existence, email is not a tier decider now
      .eq('id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') { // Profile not found for a non-anonymous user
        console.error(`Data inconsistency: User ${userId} is not anonymous but has no profile.`);
        return 'unknown'; // Data inconsistency
      } else { // Other database error while fetching profile
        console.error('Error fetching profile for non-anonymous user:', profileError);
        return 'unknown';
      }
    }

    if (!profile) { // Safeguard: Profile not found for a non-anonymous user
        console.error(`Data inconsistency: User ${userId} is not anonymous but has no profile (safeguard).`);
        return 'unknown';
    }

    // User is not anonymous and has a profile. Check subscriptions.
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (subError) {
      console.error('Error fetching subscription for non-anonymous user:', subError);
      return 'free'; // Fail-safe to 'free'
    }

    if (activeSubscription) {
      return 'pro';
    } else {
      return 'free';
    }

  } catch (error) { // Catch-all for other unexpected errors
    console.error('Unexpected error in getUserTier:', error);
    return 'unknown';
  }
} 