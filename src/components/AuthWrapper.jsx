"use client";

import { useConvexAuth, useQuery, useAction } from "convex/react";
import { useState, useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";
import SignIn from "./SignIn";

export default function AuthWrapper({ children }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const [authState, setAuthState] = useState("loading"); // "loading" | "authenticated" | "unauthenticated"
  const connectedCalendars = useQuery(api.googleCalendar.listConnectedCalendars);
  const syncGoogleCalendar = useAction(api.googleCalendar.syncGoogleCalendar);
  const hasSyncedRef = useRef(false);

  // Auto-sync calendar after authentication
  useEffect(() => {
    if (isAuthenticated && connectedCalendars && connectedCalendars.length > 0 && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      const calendar = connectedCalendars[0];
      syncGoogleCalendar({ calendarId: calendar.googleCalendarId })
        .then((result) => {
        })
        .catch((error) => {
          console.error("[AuthWrapper] Calendar sync failed:", error);
        });
    }
  }, [isAuthenticated, connectedCalendars, syncGoogleCalendar]);

  useEffect(() => {
    // Check if we have a code in the URL (OAuth callback in progress)
    const urlParams = new URLSearchParams(window.location.search);
    const hasCode = urlParams.has("code");
    
    if (hasCode) {
      // OAuth callback in progress - wait for it to complete
      setAuthState("loading");
      return;
    }

    // Check localStorage for existing tokens
    const storageKeys = Object.keys(localStorage);
    const hasTokens = storageKeys.some(key => 
      key.includes("__convexAuthJWT") || key.includes("__convexAuthRefreshToken")
    );

    if (hasTokens || isAuthenticated) {
      setAuthState("authenticated");
    } else if (!isLoading) {
      setAuthState("unauthenticated");
    }
  }, [isLoading, isAuthenticated]);

  // Also update when isAuthenticated changes
  useEffect(() => {
    if (isAuthenticated) {
      setAuthState("authenticated");
    }
  }, [isAuthenticated]);

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (authState === "unauthenticated") {
    return <SignIn />;
  }

  return children;
}
