'use server'

import { createClient as createSupabaseClient } from '@/lib/supabase/server';

export type UserTier = 'guest' | 'free' | 'pro' | 'unknown';

export async function getUserTier(userId: string): Promise<UserTier> {
  if (!userId) {
    return 'guest'; // Or 'unknown', but guest seems appropriate if no userId is provided
  }

  const supabase = await createSupabaseClient();

  try {
    // Check for profile and email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116: 'No rows found'
      console.error('Error fetching profile for tier check:', profileError);
      return 'unknown';
    }

    if (!profile || !profile.email) {
      // No profile record or no email means they are a guest
      return 'guest';
    }

    // Email exists, now check for active subscription
    // Assuming 'active' or 'trialing' means a "pro" user. Adjust statuses if needed.
    const { data: activeSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing']) // Ensure these are your active statuses
      .maybeSingle(); // Use maybeSingle as user might not have a subscription or not an active one

    if (subError) {
      console.error('Error fetching subscription for tier check:', subError);
      // Depending on desired behavior, could default to 'free' or 'unknown'
      return 'free'; // Fail-safe to 'free' if subscription check fails but email exists
    }

    if (activeSubscription) {
      return 'pro';
    } else {
      return 'free';
    }

  } catch (error) {
    console.error('Unexpected error in getUserTier:', error);
    return 'unknown';
  }
} 