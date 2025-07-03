"use client";

import React, { createContext, useContext } from 'react';

// Create a context to provide platform functionality
const TauriContext = createContext({
  isTauri: false,
  isLoaded: true,
});

/**
 * Provider component for platform functionality
 * Since we've removed Tauri, this is now a web-only stub
 */
export function TauriProvider({ children }) {
  // Always return web-only state since we've removed Tauri
  const tauriState = {
    isTauri: false,
    isLoaded: true,
  };

  return (
    <TauriContext.Provider value={tauriState}>
      {children}
    </TauriContext.Provider>
  );
}

/**
 * Hook to access platform functionality
 * Will always return web-only state
 */
export function useTauri() {
  return useContext(TauriContext);
}
