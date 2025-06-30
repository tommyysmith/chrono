"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isTauri } from '../utils/platform';

// Create a context to provide Tauri-specific functionality
const TauriContext = createContext({
  isTauri: false,
  isLoaded: false,
});

/**
 * Provider component that makes Tauri functionality available to the app
 * only when running in a desktop environment
 */
export function TauriProvider({ children }) {
  const [tauriState, setTauriState] = useState({
    isTauri: false,
    isLoaded: false,
  });

  useEffect(() => {
    // Check if we're in a Tauri environment
    const tauriEnabled = isTauri();
    
    // If we're in Tauri, dynamically import Tauri APIs
    if (tauriEnabled) {
      // This will only load in desktop environments
      import('@tauri-apps/api').then((tauriApi) => {
        setTauriState({
          isTauri: true,
          isLoaded: true,
          api: tauriApi,
        });
      }).catch(error => {
        console.error('Failed to load Tauri API:', error);
        setTauriState({
          isTauri: true,
          isLoaded: false,
          error,
        });
      });
    } else {
      // In browser environments, mark as loaded but not Tauri
      setTauriState({
        isTauri: false,
        isLoaded: true,
      });
    }
  }, []);

  return (
    <TauriContext.Provider value={tauriState}>
      {children}
    </TauriContext.Provider>
  );
}

/**
 * Hook to access Tauri functionality
 * Will only provide actual Tauri API in desktop environments
 */
export function useTauri() {
  return useContext(TauriContext);
}
