'use client';

import { useEffect } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';
import { setSupabaseAuthToken } from '@/lib/supabase';

export default function SupabaseProvider({ children }) {
  const { getToken, userId } = useAuth();
  const { isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    // If user is signed in, get JWT token and store it for Supabase requests
    if (isSignedIn && userId) {
      const updateToken = async () => {
        try {
          // Get JWT token from Clerk with Supabase template
          const token = await getToken({ template: 'supabase' });

          if (token) {
            // Store the token for use in Supabase requests
            setSupabaseAuthToken(token);
          }
        } catch (error) {
          console.error('Error getting Clerk token for Supabase:', error);
        }
      };

      updateToken();

      // Refresh the token every 45 minutes (tokens expire after 1 hour)
      const intervalId = setInterval(updateToken, 45 * 60 * 1000);

      return () => clearInterval(intervalId);
    } else if (!isSignedIn) {
      // Clear token when user signs out
      setSupabaseAuthToken(null);
    }
  }, [isLoaded, isSignedIn, userId, getToken]);

  return <>{children}</>;
}