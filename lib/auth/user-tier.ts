// @ts-nocheck
'use server'

import { createClient as createSupabaseClient } from '@/lib/supabase/server';

export type UserTier = 'guest' | 'free' | 'pro' | 'unknown';

export async function getUserTier(userId: string): Promise<UserTier> {
  if (!userId || userId === 'anonymous') { // Treat literal 'anonymous' string as invalid/unknown userId
    return 'unknown';
  }

  try {
    const supabase = await createSupabaseClient();

    // 1. Fetch is_anonymous status directly from auth.users table
    const { data: authUser, error: authUserError } = await supabase
      .from('users') // Supabase internal auth table is 'users' in the 'auth' schema
      .select('is_anonymous')
      .eq('id', userId)
      .single();

    if (authUserError) {
      if (authUserError.code === 'PGRST116') { // User ID not found in auth.users
        return 'unknown';
      } else { // Other database error while fetching from auth.users
        console.error('Error fetching user from auth.users:', authUserError);
        return 'unknown';
      }
    }

    if (!authUser) { // Safeguard: Should be covered by PGRST116 for auth.users
      return 'unknown';
    }

    // 2. If user is anonymous as per auth.users, they are 'guest'
    if ((authUser as any).is_anonymous === true) {
      return 'guest';
    }

    // 3. User is NOT anonymous (is_anonymous === false from auth.users).
    //    Check for a corresponding profile for data integrity.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id') // We only need to check for existence, email is not a tier decider now
      .eq('id', userId)
      .single();

    if (profileError) {
      if (profileError.code === 'PGRST116') { // Profile not found for a non-anonymous user
        console.error(`Data inconsistency: User ${userId} is not anonymous in auth.users but has no profile.`);
        return 'unknown'; // Data inconsistency
      } else { // Other database error while fetching profile
        console.error('Error fetching profile for non-anonymous user:', profileError);
        return 'unknown';
      }
    }

    if (!profile) { // Safeguard: Profile not found for a non-anonymous user
        console.error(`Data inconsistency: User ${userId} is not anonymous in auth.users but has no profile (safeguard).`);
        return 'unknown';
    }

    // 4. User is not anonymous and has a profile. Check subscriptions.
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