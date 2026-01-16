// Hook for Google Calendar sync operations using Convex
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Sync interval in milliseconds (30 seconds)
const SYNC_INTERVAL = 30 * 1000;

export const useGoogleCalendarSync = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const syncIntervalRef = useRef(null);
  const setupAttemptedRef = useRef(false);
  
  // Convex queries and actions - only query when authenticated
  const connectedCalendars = useQuery(
    api.googleCalendar.listConnectedCalendars,
    isAuthenticated ? {} : "skip"
  );
  const fullSync = useAction(api.googleCalendar.fullSync);
  const pushEventToGoogle = useAction(api.googleCalendar.pushEventToGoogle);
  const deleteGoogleEvent = useAction(api.googleCalendar.deleteGoogleEvent);
  const setupCalendarConnection = useMutation(api.googleCalendar.setupCalendarConnection);
  const fixCalendarId = useMutation(api.googleCalendar.fixCalendarId);
  const calendarIdFixedRef = useRef(false);

  /**
   * Perform a full bi-directional sync
   */
  const performSync = useCallback(async () => {
    if (!isAuthenticated || isSyncing) {
      return null;
    }

    if (!connectedCalendars || connectedCalendars.length === 0) {
      return null;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await fullSync();
      setLastSyncTime(Date.now());
      return result;
    } catch (error) {
      console.error('[useGoogleCalendarSync] Sync error:', error);
      setSyncError(error.message || 'Sync failed');
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isSyncing, connectedCalendars, fullSync]);

  /**
   * Push a single event to Google Calendar
   */
  const syncEventToGoogle = useCallback(async (eventId) => {
    if (!isAuthenticated) return null;

    try {
      const result = await pushEventToGoogle({ eventId });
      return result;
    } catch (error) {
      console.error('[useGoogleCalendarSync] Error pushing event:', error);
      return null;
    }
  }, [isAuthenticated, pushEventToGoogle]);

  /**
   * Delete an event from Google Calendar
   */
  const deleteEventFromGoogle = useCallback(async (calendarId, googleEventId) => {
    if (!isAuthenticated) return null;

    try {
      const result = await deleteGoogleEvent({ calendarId, googleEventId });
      return result;
    } catch (error) {
      console.error('[useGoogleCalendarSync] Error deleting event:', error);
      return null;
    }
  }, [isAuthenticated, deleteGoogleEvent]);

  /**
   * Start periodic background sync
   */
  const startBackgroundSync = useCallback(() => {
    if (syncIntervalRef.current) {
      return; // Already running
    }

    
    // Perform initial sync
    performSync();

    // Set up interval for periodic sync
    syncIntervalRef.current = setInterval(() => {
      performSync();
    }, SYNC_INTERVAL);
  }, [performSync]);

  /**
   * Stop periodic background sync
   */
  const stopBackgroundSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
  }, []);

  // Fix calendar IDs that use email instead of "primary" (one-time fix)
  useEffect(() => {
    if (isLoading || !isAuthenticated || calendarIdFixedRef.current) return;
    
    if (connectedCalendars && Array.isArray(connectedCalendars) && connectedCalendars.length > 0) {
      // Check if any calendar has an ID that's not "primary"
      const needsFix = connectedCalendars.some(cal => cal.googleCalendarId !== "primary");
      if (needsFix) {
        calendarIdFixedRef.current = true;
        fixCalendarId().then(() => {
        }).catch(err => {
          console.error('[useGoogleCalendarSync] Failed to fix calendar IDs:', err);
        });
      }
    }
    
    if (connectedCalendars !== undefined && 
        Array.isArray(connectedCalendars) &&
        connectedCalendars.length === 0) {
    }
  }, [isAuthenticated, isLoading, connectedCalendars, fixCalendarId]);

  // Auto-start background sync when authenticated and calendars are connected
  useEffect(() => {
    const shouldSync = isAuthenticated && connectedCalendars && connectedCalendars.length > 0;
    
      isAuthenticated,
      calendarsLength: connectedCalendars?.length || 0,
      shouldSync,
    });
    
    if (shouldSync) {
      // Start sync if not already running
      if (!syncIntervalRef.current) {
        performSync();
        syncIntervalRef.current = setInterval(() => {
          performSync();
        }, SYNC_INTERVAL);
      }
    } else {
      // Stop sync if running
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, connectedCalendars?.length]);

  // Get the primary calendar ID (first connected calendar)
  const primaryCalendarId = connectedCalendars?.[0]?.googleCalendarId || null;

  return {
    // State
    isSyncing,
    lastSyncTime,
    syncError,
    connectedCalendars: connectedCalendars || [],
    primaryCalendarId,
    isConnected: connectedCalendars && connectedCalendars.length > 0,
    
    // Actions
    performSync,
    syncEventToGoogle,
    deleteEventFromGoogle,
    startBackgroundSync,
    stopBackgroundSync,
  };
};

