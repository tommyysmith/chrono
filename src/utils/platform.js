/**
 * Utility functions for platform detection and Tauri functionality
 */

/**
 * Check if the application is running in a Tauri desktop environment
 * @returns {boolean} True if running in Tauri, false if running in a browser
 */
export const isTauri = () => {
  // Check if the window object exists (for SSR compatibility)
  if (typeof window !== 'undefined') {
    // Tauri adds a __TAURI__ object to the window
    return !!window.__TAURI__;
  }
  return false;
};

/**
 * Check if the application is running in a web browser
 * @returns {boolean} True if running in a browser, false if running in Tauri
 */
export const isBrowser = () => {
  return !isTauri();
};

/**
 * Get platform-specific configuration
 * @returns {Object} Platform-specific configuration values
 */
export const getPlatformConfig = () => {
  return {
    isDesktop: isTauri(),
    isBrowser: isBrowser(),
    // Add other platform-specific configurations as needed
  };
};
