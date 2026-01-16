'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function CalendarSync() {
  const connectedCalendars = useQuery(api.googleCalendar.listConnectedCalendars);
  const hasGoogleAccess = useQuery(api.googleCalendar.hasGoogleCalendarAccess);
  const syncGoogleCalendar = useAction(api.googleCalendar.syncGoogleCalendar);
  const setupCalendarFromAuth = useMutation(api.googleCalendar.setupCalendarFromAuth);
  const syncedRef = useRef(new Set());
  const setupAttemptedRef = useRef(false);

  // First, try to set up calendar from auth tokens
  useEffect(() => {
    
    if (setupAttemptedRef.current) return;
    if (hasGoogleAccess === undefined) {
      return; // Still loading
    }
    
    // If we have auth tokens but no calendar connection, set it up
    if (hasGoogleAccess?.hasAuthTokens && !hasGoogleAccess?.connected) {
      setupAttemptedRef.current = true;
      
      setupCalendarFromAuth()
        .then((result) => {
        })
        .catch((error) => {
          console.error("CalendarSync: Setup failed:", error);
        });
    } else if (hasGoogleAccess?.connected) {
      setupAttemptedRef.current = true;
    } else if (hasGoogleAccess && !hasGoogleAccess.hasAuthTokens) {
    }
  }, [hasGoogleAccess, setupCalendarFromAuth]);

  // Auto-sync calendars when they're connected
  useEffect(() => {
    if (!connectedCalendars || connectedCalendars.length === 0) return;
    
    const syncCalendars = async () => {
      for (const calendar of connectedCalendars) {
        // Skip if already synced in this session
        if (syncedRef.current.has(calendar.googleCalendarId)) continue;
        
        // Skip if recently synced (within last 5 minutes)
        const lastSync = calendar.lastSyncedAt ? new Date(calendar.lastSyncedAt).getTime() : 0;
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        if (lastSync > fiveMinutesAgo) {
          syncedRef.current.add(calendar.googleCalendarId);
          continue;
        }
        
        if (!calendar.syncEnabled) continue;
        
        syncedRef.current.add(calendar.googleCalendarId);
        
        try {
          await syncGoogleCalendar({ calendarId: calendar.googleCalendarId });
        } catch (error) {
          console.error("CalendarSync: Failed to sync calendar:", calendar.googleCalendarId, error);
        }
      }
    };
    
    syncCalendars();
  }, [connectedCalendars, syncGoogleCalendar]);

  return null;
}

