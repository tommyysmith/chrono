'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { migrateLocalStorageToSupabase, createMigrationBackup, clearLocalStorageAfterMigration } from '../lib/migrationScript';
import { isSupabaseEnabled } from '../lib/supabase';

const USE_SUPABASE = process.env.NEXT_PUBLIC_USE_SUPABASE === 'true';

export default function DataMigrationPanel() {
  const { user } = useUser();
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState(null);

  if (!USE_SUPABASE || !isSupabaseEnabled()) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h3 className="font-semibold mb-2">Supabase Not Enabled</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Set <code>NEXT_PUBLIC_USE_SUPABASE=true</code> in your environment variables to enable data migration.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm">Please sign in to migrate your data.</p>
      </div>
    );
  }

  const handleMigration = async () => {
    if (!window.confirm('This will migrate all your localStorage data to Supabase. Continue?')) {
      return;
    }

    setMigrating(true);
    try {
      await createMigrationBackup();

      const log = await migrateLocalStorageToSupabase(user.id);
      setMigrationLog(log);

      alert('Migration completed! Check the console for details.');
    } catch (error) {
      console.error('Migration failed:', error);
      alert(`Migration failed: ${error.message}`);
    } finally {
      setMigrating(false);
    }
  };

  const handleClearLocalStorage = () => {
    const cleared = clearLocalStorageAfterMigration();
    if (cleared) {
      alert('localStorage cleared. Your data is now only in Supabase.');
      window.location.reload();
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-xl font-semibold mb-4">Data Migration to Supabase</h2>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
            <h3 className="font-semibold mb-2">Before You Start:</h3>
            <ul className="list-disc list-inside text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <li>A backup will be automatically downloaded</li>
              <li>Existing data in Supabase won't be deleted</li>
              <li>Migration can take a few seconds for large datasets</li>
              <li>Check browser console for detailed logs</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleMigration}
              disabled={migrating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md font-medium transition-colors"
            >
              {migrating ? 'Migrating...' : 'Migrate Data to Supabase'}
            </button>

            <button
              onClick={createMigrationBackup}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
            >
              Download Backup Only
            </button>
          </div>

          {migrationLog && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
              <h3 className="font-semibold mb-2">Migration Results:</h3>
              <div className="text-sm space-y-1">
                <p>✓ Views: {migrationLog.views.succeeded}/{migrationLog.views.attempted}</p>
                <p>✓ Events: {migrationLog.events.succeeded}/{migrationLog.events.attempted}</p>
                <p>✓ Tasks: {migrationLog.tasks.succeeded}/{migrationLog.tasks.attempted}</p>
              </div>

              <button
                onClick={handleClearLocalStorage}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors text-sm"
              >
                Clear localStorage (Optional)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}