"use client";

import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { loadViews, loadActiveViewIds } from "../utils/viewUtils";

const MigrationHelper = () => {
  const [migrationStatus, setMigrationStatus] = useState("idle"); // idle, migrating, success, error
  const [migrationResult, setMigrationResult] = useState(null);
  const [mounted, setMounted] = useState(false);
  
  const migrateData = useMutation(api.migration.migrateLocalStorageData);
  const checkExistingData = useMutation(api.migration.checkExistingData);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMigration = async () => {
    try {
      setMigrationStatus("migrating");

      // Check if user already has data in Convex
      const existingData = await checkExistingData({ userId: undefined });
      
      if (existingData.hasData) {
        const confirmOverwrite = window.confirm(
          `You already have ${existingData.counts.views} views, ${existingData.counts.events} events, and ${existingData.counts.tasks} tasks in Convex. Do you want to proceed? This will add to your existing data.`
        );
        
        if (!confirmOverwrite) {
          setMigrationStatus("idle");
          return;
        }
      }

      // Gather localStorage data
      const views = loadViews();
      const activeViewIds = loadActiveViewIds();
      
      // Get events from localStorage
      const eventsData = localStorage.getItem('calendarEvents');
      const events = eventsData ? JSON.parse(eventsData) : [];
      
      // Get tasks from localStorage 
      const tasksData = localStorage.getItem('tasks');
      const tasksObj = tasksData ? JSON.parse(tasksData) : {};
      const tasks = tasksObj.all || [];

      // Perform migration
      const result = await migrateData({
        views,
        events,
        tasks,
        activeViewIds,
        userId: undefined, // We'll add auth later
      });

      if (result.success) {
        setMigrationStatus("success");
        setMigrationResult(result);
        
        // Optionally clear localStorage after successful migration
        const clearLocal = window.confirm(
          "Migration successful! Would you like to clear your localStorage data now that it's safely stored in Convex?"
        );
        
        if (clearLocal) {
          localStorage.removeItem('calendarEvents');
          localStorage.removeItem('tasks');
          localStorage.removeItem('calendarViews');
          localStorage.removeItem('activeViewIds');
        }
      } else {
        setMigrationStatus("error");
        setMigrationResult(result);
      }
    } catch (error) {
      console.error("Migration error:", error);
      setMigrationStatus("error");
      setMigrationResult({ error: error.message });
    }
  };

  const getLocalStorageDataCount = () => {
    try {
      const views = loadViews();
      const eventsData = localStorage.getItem('calendarEvents');
      const events = eventsData ? JSON.parse(eventsData) : [];
      const tasksData = localStorage.getItem('tasks');
      const tasksObj = tasksData ? JSON.parse(tasksData) : {};
      const tasks = tasksObj.all || [];

      return { views: views.length, events: events.length, tasks: tasks.length };
    } catch {
      return { views: 0, events: 0, tasks: 0 };
    }
  };

  const localData = getLocalStorageDataCount();
  const hasLocalData = localData.views > 0 || localData.events > 0 || localData.tasks > 0;

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  if (!hasLocalData && migrationStatus === "idle") {
    return null; // Don't show if no local data to migrate
  }

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Migrate to Cloud Backend
          </p>
          
          {migrationStatus === "idle" && (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Found {localData.views} views, {localData.events} events, {localData.tasks} tasks in local storage.
              </p>
              <button
                onClick={handleMigration}
                className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors"
              >
                Migrate to Convex
              </button>
            </>
          )}
          
          {migrationStatus === "migrating" && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Migrating data...
            </p>
          )}
          
          {migrationStatus === "success" && (
            <div className="mt-1">
              <p className="text-xs text-green-600 dark:text-green-400">
                {migrationResult?.message}
              </p>
              <button
                onClick={() => setMigrationStatus("idle")}
                className="mt-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          )}
          
          {migrationStatus === "error" && (
            <div className="mt-1">
              <p className="text-xs text-red-600 dark:text-red-400">
                Migration failed: {migrationResult?.error}
              </p>
              <div className="flex space-x-2 mt-1">
                <button
                  onClick={handleMigration}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Retry
                </button>
                <button
                  onClick={() => setMigrationStatus("idle")}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MigrationHelper; 