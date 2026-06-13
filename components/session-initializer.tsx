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

  // Helper function to dispatch auth completion event with success/failure info
  const dispatchAuthComplete = useCallback((success: boolean, error?: string, user?: User | null) => {
    window.dispatchEvent(new CustomEvent('auth-complete', {
      detail: {
        success,
        error: error || null,
        user: user || null
      }
    }));
  }, []);

  const attemptAnonymousSignIn = useCallback(async (token?: string | null) => {
    setIsLoading(true);
    try {
      // Pass a captcha token only when Turnstile is configured; otherwise sign
      // in anonymously without one (Turnstile is optional for local/self-host).
      const { data, error } = await supabase.auth.signInAnonymously(
        token ? { options: { captchaToken: token } } : undefined
      );

      if (error) {
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
        dispatchAuthComplete(false, error.message);
      } else if (data?.user) {
        setCurrentUser(data.user);
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
        dispatchAuthComplete(true, undefined, data.user);
      } else {
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
        dispatchAuthComplete(false, 'No user returned from sign-in');
      }
    } catch (e) {
        sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true');
        const errorMessage = e instanceof Error ? e.message : 'Unknown error during sign-in';
        dispatchAuthComplete(false, errorMessage);
    } finally {
      setIsLoading(false);
      setShowTurnstile(false); // Hide Turnstile after attempt
      setTurnstileToken(null); // Reset token
    }
  }, [supabase, dispatchAuthComplete]);

  useEffect(() => {
    const checkUserSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      setIsLoading(false);
      if (sessionError) {
        // Begin anonymous sign-in (via Turnstile if configured, else directly)
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
            beginAnonymousSignIn();
        } else {
          // Auth already attempted but failed
          dispatchAuthComplete(false, sessionError.message);
        }
        return;
      }

      if (session?.user) {
        setCurrentUser(session.user);
        sessionStorage.removeItem(SESSION_ANONYMOUS_ATTEMPTED_KEY); // Clear attempt flag if user is found
        // User already authenticated, mark as successful
        dispatchAuthComplete(true, undefined, session.user);
      } else {
        // No active session, check if we've already tried anonymous sign-in in this browser session
        if (!sessionStorage.getItem(SESSION_ANONYMOUS_ATTEMPTED_KEY)) {
          beginAnonymousSignIn(); // Turnstile widget if configured, else tokenless
        } else {
          // Auth already attempted but we have no user - consider it failed
          dispatchAuthComplete(false, 'Anonymous sign-in was attempted but no session exists');
        }
      }
    };

    // When Turnstile is configured, show the widget to obtain a token; without
    // a site key, sign in anonymously directly (Turnstile optional).
    const beginAnonymousSignIn = () => {
      if (turnstileSiteKey) {
        setShowTurnstile(true);
      } else {
        attemptAnonymousSignIn();
      }
    };

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

  }, [supabase, turnstileSiteKey, dispatchAuthComplete, attemptAnonymousSignIn]);

  useEffect(() => {
    if (turnstileToken && showTurnstile) {
      attemptAnonymousSignIn(turnstileToken);
    }
  }, [turnstileToken, showTurnstile, attemptAnonymousSignIn]);

  // No site key → no widget; anonymous sign-in happens tokenless in the effect.

  // Render Turnstile if needed. It could be styled to be less intrusive.
  // For a truly automatic anonymous sign-in, Turnstile's appearance might be 'invisible'
  // and programmatically invoked, but that's more complex to set up reliably without user interaction.
  // Using 'execute' on a hidden button or 'interaction-only' might be alternatives.
  if (showTurnstile && !currentUser && turnstileSiteKey) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
        <div className="bg-white p-4 rounded-lg shadow-xl border border-gray-200 max-w-sm mx-4">
          <Turnstile
            siteKey={turnstileSiteKey}
            onSuccess={(token) => {
              setTurnstileToken(token);
            }}
            onError={() => {
              sessionStorage.setItem(SESSION_ANONYMOUS_ATTEMPTED_KEY, 'true'); // Mark as attempted to prevent loops
              setShowTurnstile(false); // Hide on error to prevent user being stuck
              // Dispatch auth completion event on error too
              dispatchAuthComplete(false, 'Turnstile challenge failed');
            }}
            onExpire={() => {
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
      </div>
    );
  }

  // This component doesn't render anything itself once done or if user is logged in.
  // Its purpose is to initialize the session.
  return null;
} 