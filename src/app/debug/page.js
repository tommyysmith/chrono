'use client';

import { useQuery, useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useEffect, useState } from "react";

export default function DebugPage() {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const debugData = useQuery(api.googleCalendar.debugAuthData);
  const currentUser = useQuery(api.auth.currentUser);
  const [localStorageData, setLocalStorageData] = useState({});
  
  const [jwtDecoded, setJwtDecoded] = useState(null);
  
  useEffect(() => {
    // Check localStorage for auth-related keys
    const authKeys = {};
    // The namespace is derived from the Convex URL by removing protocol and special chars
    const convexUrl = "https://robust-skunk-550.convex.cloud";
    const namespace = convexUrl.replace(/[^a-zA-Z0-9]/g, "");
    console.log("Expected namespace:", namespace);
    const jwtKey = `__convexAuthJWT_${namespace}`;
    const refreshKey = `__convexAuthRefreshToken_${namespace}`;
    
    // Check specific keys we expect
    const jwtValue = localStorage.getItem(jwtKey);
    const refreshValue = localStorage.getItem(refreshKey);
    
    authKeys[jwtKey] = jwtValue ? `✅ Present (${jwtValue.length} chars)` : "❌ Missing";
    authKeys[refreshKey] = refreshValue ? `✅ Present (${refreshValue.length} chars)` : "❌ Missing";
    
    // List ALL localStorage keys to find verifier
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        // Show all keys, not just convex/auth ones
        authKeys[key] = value ? `(${value.length} chars) ${value.substring(0, 80)}...` : 'null';
      }
    }
    
    setLocalStorageData(authKeys);
    
    // Try to decode JWT
    if (jwtValue) {
      try {
        const parts = jwtValue.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          setJwtDecoded(payload);
        }
      } catch (e) {
        console.error('Failed to decode JWT:', e);
      }
    }
    
    // Log for debugging
    console.log("=== Auth Debug ===");
    console.log("JWT key:", jwtKey);
    console.log("JWT value present:", !!jwtValue);
    console.log("Refresh key:", refreshKey);
    console.log("Refresh value present:", !!refreshValue);
    console.log("All localStorage keys:", Object.keys(localStorage).map(k => `${k}: ${localStorage.getItem(k)?.substring(0, 50)}`));
  }, []);
  
  return (
    <div className="p-8 max-w-4xl mx-auto text-black dark:text-white">
      <h1 className="text-2xl font-bold mb-6">Debug Auth & Calendar Data</h1>
      
      {/* Client-side auth state */}
      <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800 mb-6">
        <h2 className="font-semibold text-lg mb-2">Client Auth State (useConvexAuth)</h2>
        <ul className="list-disc pl-5">
          <li><strong>isLoading:</strong> {isLoading ? "⏳ Yes" : "✅ No"}</li>
          <li><strong>isAuthenticated:</strong> {isAuthenticated ? "✅ Yes" : "❌ No"}</li>
        </ul>
        
        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            onClick={async () => {
              // Clear any stale verifiers first
              const keysToRemove = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.includes('Verifier') || key.includes('verifier'))) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(k => {
                console.log('Clearing stale verifier:', k);
                localStorage.removeItem(k);
              });
              
              // Now sign in
              console.log('Starting Google sign-in...');
              try {
                await signIn("google");
              } catch (err) {
                console.error('Sign-in error:', err);
                alert('Sign-in error: ' + err.message);
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            🔐 Sign In with Google
          </button>
          <button
            onClick={() => signOut()}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
          >
            🚪 Sign Out
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            🔄 Refresh Page
          </button>
        </div>
      </div>
      
      {/* LocalStorage */}
      <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800 mb-6">
        <h2 className="font-semibold text-lg mb-2">LocalStorage (auth-related keys)</h2>
        {Object.keys(localStorageData).length === 0 ? (
          <p className="text-gray-500">No auth-related keys found in localStorage</p>
        ) : (
          <pre className="text-xs bg-white dark:bg-black/20 p-2 rounded overflow-auto max-h-40">
            {JSON.stringify(localStorageData, null, 2)}
          </pre>
        )}
        
        {Object.keys(localStorageData).length > 0 && (
          <button
            onClick={() => {
              // Clear all convex auth tokens
              Object.keys(localStorage).forEach(key => {
                if (key.includes('convex') || key.includes('auth')) {
                  localStorage.removeItem(key);
                }
              });
              alert('Auth tokens cleared! Refreshing page...');
              window.location.reload();
            }}
            className="mt-3 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            🗑️ Clear All Auth Tokens & Refresh
          </button>
        )}
        
        {jwtDecoded && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Decoded JWT Payload:</h3>
            <pre className="text-xs bg-white dark:bg-black/20 p-2 rounded overflow-auto">
              {JSON.stringify(jwtDecoded, null, 2)}
            </pre>
            <p className="text-xs mt-2 text-gray-500">
              Expiry: {jwtDecoded.exp ? new Date(jwtDecoded.exp * 1000).toLocaleString() : 'N/A'}
              {jwtDecoded.exp && Date.now() > jwtDecoded.exp * 1000 && (
                <span className="text-red-500 ml-2">⚠️ TOKEN EXPIRED!</span>
              )}
            </p>
          </div>
        )}
      </div>
      
      <AuthLoading>
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded">Loading auth state...</div>
      </AuthLoading>
      
      <Unauthenticated>
        <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded mb-4">
          <strong>❌ Unauthenticated (according to Convex React)</strong>
          <p className="mt-2">This means the Convex client thinks you're not signed in.</p>
          <a href="/" className="text-blue-600 underline block mt-2">Go to home page to sign in</a>
        </div>
      </Unauthenticated>
      
      <Authenticated>
        <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded mb-4">
          <strong>✅ Authenticated (according to Convex React)</strong>
        </div>
      </Authenticated>
      
      {/* Always show these, regardless of auth state */}
      <div className="space-y-6 mt-6">
        {/* Current User */}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
          <h2 className="font-semibold text-lg mb-2">Current User (api.auth.currentUser)</h2>
          <pre className="text-sm bg-white dark:bg-black/20 p-2 rounded overflow-auto">
            {currentUser === undefined ? "Loading..." : JSON.stringify(currentUser, null, 2)}
          </pre>
        </div>
        
        {/* Debug Data */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <h2 className="font-semibold text-lg mb-2">Debug Auth Data (api.googleCalendar.debugAuthData)</h2>
          {debugData === undefined ? (
            <p>Loading...</p>
          ) : (
            <pre className="text-sm bg-white dark:bg-black/20 p-2 rounded overflow-auto max-h-96">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          )}
        </div>
        
        {/* Analysis */}
        {debugData && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded border border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-lg mb-2">Analysis</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Server says authenticated:</strong> {debugData.status === "authenticated" ? "✅ Yes" : "❌ No"}
              </li>
              <li>
                <strong>Identity email:</strong> {debugData.identity?.email || "❌ Missing"}
              </li>
              <li>
                <strong>Identity name:</strong> {debugData.identity?.name || "❌ Missing"}
              </li>
              <li>
                <strong>Auth accounts:</strong> {debugData.authAccountsCount || 0}
              </li>
              <li>
                <strong>Has Google account with tokens:</strong>{" "}
                {debugData.authAccounts?.some(a => a.hasAccessToken) ? "✅ Yes" : "❌ No"}
              </li>
              <li>
                <strong>Connected calendars:</strong> {debugData.connectedCalendars || 0}
              </li>
            </ul>
            
            {debugData.authAccounts?.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium">Auth Account Fields:</h3>
                <pre className="text-xs bg-white dark:bg-black/20 p-2 rounded mt-1">
                  {JSON.stringify(debugData.authAccounts[0]?.allFields, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
