'use client';

import { useEffect, useState, useRef } from 'react';
import { useMutation, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function GoogleCalendarCallback({ onSuccess }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const storeCalendarConnection = useMutation(api.googleCalendar.storeCalendarConnection);
  const syncGoogleCalendar = useAction(api.googleCalendar.syncGoogleCalendar);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const processedRef = useRef(false);
  const [callbackData, setCallbackData] = useState(null);

  // Extract callback data on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleAuth = urlParams.get('google_auth');
    const accessToken = urlParams.get('access_token');
    const email = urlParams.get('email');
    const refreshToken = urlParams.get('refresh_token');
    const calendarName = urlParams.get('calendar_name');
    
    if (googleAuth === 'success' && accessToken && email) {
      setCallbackData({ accessToken, email, refreshToken, calendarName });
      // Clean URL immediately to prevent auth conflicts
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Process the callback when we have data
  const handleConnect = async () => {
    if (!callbackData || processedRef.current || isProcessing) return;
    
    processedRef.current = true;
    setIsProcessing(true);
    setError(null);
    
    const { accessToken, email, refreshToken, calendarName } = callbackData;
    
    // Retry logic
    const maxRetries = 5;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const waitTime = attempt * 1500;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      try {
        await storeCalendarConnection({
          accountEmail: email,
          googleCalendarId: email,
          googleCalendarName: calendarName || "Primary",
          accessTokenEncrypted: accessToken,
          refreshTokenEncrypted: refreshToken || undefined,
        });
        
        
        // Try to sync events
        try {
          await syncGoogleCalendar({ calendarId: email });
        } catch (syncError) {
          console.error("Failed to sync calendar:", syncError);
        }
        
        setCallbackData(null);
        setIsProcessing(false);
        if (onSuccess) onSuccess();
        return;
        
      } catch (err) {
        console.error(`Attempt ${attempt} failed:`, err.message);
        lastError = err;
        if (!err.message.includes("Not authenticated")) {
          break;
        }
      }
    }
    
    // All retries failed
    console.error("All attempts failed:", lastError);
    setError(lastError?.message || "Failed to connect calendar");
    processedRef.current = false;
    setIsProcessing(false);
  };

  // Auto-start connection when authenticated and have callback data
  useEffect(() => {
    if (callbackData && !processedRef.current && !isProcessing && isAuthenticated && !isLoading) {
      // Auto-connect if already authenticated
      const timer = setTimeout(() => {
        handleConnect();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [callbackData, isAuthenticated, isLoading]);

  // Show loading indicator while processing
  if (isProcessing) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-dark-bg-light p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-light-text dark:text-dark-text">Connecting Google Calendar...</p>
        </div>
      </div>
    );
  }

  // Show error with retry option
  if (error && callbackData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-dark-bg-light p-6 rounded-lg shadow-xl flex flex-col items-center gap-4 max-w-md">
          <p className="text-red-500 text-center">Failed to connect calendar: {error}</p>
          <p className="text-light-text/70 dark:text-dark-text/70 text-sm text-center">
            Please make sure you're signed in and try again.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                processedRef.current = false;
                setError(null);
                handleConnect();
              }}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Retry
            </button>
            <button
              onClick={() => {
                setCallbackData(null);
                setError(null);
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-dark-bg text-light-text dark:text-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-dark-bg-lighter"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show pending connection prompt
  if (callbackData && !isProcessing) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-dark-bg-light p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
          <p className="text-light-text dark:text-dark-text font-medium">Connect Google Calendar</p>
          <p className="text-light-text/70 dark:text-dark-text/70 text-sm">
            Calendar: {callbackData.email}
          </p>
          <div className="text-xs text-light-text/50 dark:text-dark-text/50">
            Auth status: {isLoading ? "Loading..." : isAuthenticated ? "✓ Signed in" : "✗ Not signed in"}
          </div>
          {!isAuthenticated && !isLoading && (
            <p className="text-amber-500 text-sm text-center">
              Please sign in first, then click Connect.
            </p>
          )}
          <button
            onClick={handleConnect}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? "Loading..." : "Connect Now"}
          </button>
          <button
            onClick={() => setCallbackData(null)}
            className="text-sm text-light-text/50 dark:text-dark-text/50 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}

