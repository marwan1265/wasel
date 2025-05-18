'use client';

import { createClient } from '@/lib/supabase/client'; // Your Supabase client
import { Turnstile } from '@marsidev/react-turnstile';
import { User } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

const SESSION_ANONYMOUS_ATTEMPTED_KEY = 'morphic_anonymous_signIn_attempted';

export function SessionInitializer() {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const attemptAnonymousSignIn = useCallback(async (token: string) => {
    console.log('Attempting anonymous sign-in with Turnstile token...');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          captchaToken: token,
        },
      });

      if (error) {
        console.error('Error during anonymous sign-in:', error.message);
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true'); // Mark as attempted even on error to prevent loops
      } else if (data?.user) {
        console.log('Successfully signed in anonymously:', data.user.id);
        setCurrentUser(data.user);
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
      } else {
        console.warn('Anonymous sign-in did not return a user or error.');
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
      }
    } catch (e) {
        console.error('Exception during anonymous sign-in:', e);
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
    } finally {
      setIsLoading(false);
      setShowTurnstile(false); // Hide Turnstile after attempt
      setTurnstileToken(null); // Reset token
    }
  }, [supabase]);

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      setIsLoading(false);
      if (sessionError) {
        console.error("Error fetching session:", sessionError);
        // Potentially show Turnstile if we can't even get a session and want to try anon sign in
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
            setShowTurnstile(true);
        }
        return;
      }

      if (session?.user) {
        setCurrentUser(session.user);
        console.log('User session found:', session.user.id);
        sessionStorage.removeItem(SESSION_ANONYMOUS_ATTEMPTED_KEY); // Clear attempt flag if user is found
      } else {
        // No active session, check if we've already tried anonymous sign-in in this browser session
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
          console.log('No active session, preparing for anonymous sign-in.');
          setShowTurnstile(true); // Show Turnstile to get a token
        } else {
          console.log('Anonymous sign-in already attempted in this session.');
        }
      }
    };

    if (!turnstileSiteKey) {
      console.error('Turnstile site key is not configured. Cannot attempt anonymous sign-in.');
      setIsLoading(false);
      return;
    }
    checkUserSession();
    
    // Listen to auth changes to update currentUser state
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user ?? null);
        if (session?.user) {
            sessionStorage.removeItem(SESSION_ANONYMOUS_ATTEMPTED_KEY);
        } else {
            // If user becomes null (e.g. logout) and we haven't attempted anon in this session, show turnstile
            if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
                // setShowTurnstile(true); // Potentially re-show if user logs out. Careful with loops.
            }
        }
    });

    return () => {
        authListener?.subscription?.unsubscribe();
    };

  }, [supabase, turnstileSiteKey]);

  useEffect(() => {
    if (turnstileToken && showTurnstile) {
      attemptAnonymousSignIn(turnstileToken);
    }
  }, [turnstileToken, showTurnstile, attemptAnonymousSignIn]);

  if (!turnstileSiteKey) {
    // This case is handled in useEffect, but as a fallback for render:
    return <div className="p-2 text-xs text-red-500 text-center">CAPTCHA configuration error.</div>;
  }
  
  // Render Turnstile if needed. It could be styled to be less intrusive.
  // For a truly automatic anonymous sign-in, Turnstile's appearance might be 'invisible'
  // and programmatically invoked, but that's more complex to set up reliably without user interaction.
  // Using 'execute' on a hidden button or 'interaction-only' might be alternatives.
  if (showTurnstile && !currentUser) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-white p-2 shadow-lg rounded border border-gray-300">
        <p className="text-xs text-gray-600 mb-1">Verifying session...</p>
        <Turnstile
          siteKey={turnstileSiteKey}
          onSuccess={(token) => {
            console.log('Turnstile token obtained for anonymous sign-in.');
            setTurnstileToken(token);
          }}
          onError={() => {
            console.error('Turnstile challenge failed for anonymous sign-in.');
            sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true'); // Mark as attempted to prevent loops
            setShowTurnstile(false); // Hide on error to prevent user being stuck
          }}
          onExpire={() => {
            console.log('Turnstile token expired.');
            setTurnstileToken(null);
            // Optionally re-show or re-attempt based on your strategy
          }}
          options={{
            theme: 'light',
            // appearance: 'interaction-only', // Or 'execute' if you have a trigger
            // For a truly seamless experience, an invisible Turnstile is ideal but needs careful triggering.
          }}
        />
      </div>
    );
  }

  // This component doesn't render anything itself once done or if user is logged in.
  // Its purpose is to initialize the session.
  return null;
} 