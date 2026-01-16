'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check } from '../assets/icons/Check';
import { Trash } from '../assets/icons/Trash';

const CalendarConnectionItem = ({ calendar, onDisconnect, isDisconnecting }) => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDisconnect = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    await onDisconnect(calendar.id);
    setShowConfirm(false);
  };

  const getSyncStatusColor = (status) => {
    switch (status) {
      case 'synced':
        return 'text-green-500';
      case 'syncing':
        return 'text-blue-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSyncStatusText = (status) => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-light-bg-light dark:bg-dark-bg-light rounded-[9px] border border-light-border dark:border-dark-border">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-light-text dark:text-dark-text">
            {calendar.name}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs ${getSyncStatusColor(calendar.syncStatus)}`}>
              {getSyncStatusText(calendar.syncStatus)}
            </span>
            {calendar.lastSyncedAt && (
              <>
                <span className="text-xs text-light-text/50 dark:text-dark-text/50">•</span>
                <span className="text-xs text-light-text/50 dark:text-dark-text/50">
                  {new Date(calendar.lastSyncedAt).toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <motion.button
        onClick={handleDisconnect}
        disabled={isDisconnecting}
        className={`px-3 py-1.5 text-xs rounded-[5px] font-medium transition-colors ${
          showConfirm
            ? 'bg-red-500 text-white hover:bg-red-600'
            : 'bg-light-bg-lighter dark:bg-dark-bg-lighter text-light-text/70 dark:text-dark-text/70 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
        }`}
        whileTap={{ scale: 0.98 }}
      >
        {showConfirm ? 'Confirm?' : 'Disconnect'}
      </motion.button>
    </div>
  );
};

const CalendarConnectionList = ({ onRefresh }) => {
  const [connectedCalendars, setConnectedCalendars] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const loadConnectedCalendars = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/google/calendars');
      const data = await response.json();

      if (response.ok && data.calendars) {
        // Filter to show only connected calendars
        const connected = data.calendars.filter(cal => cal.connected);
        setConnectedCalendars(connected.map(cal => ({
          id: cal.id,
          name: cal.name,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
        })));
      }
    } catch (error) {
      console.error('Error loading connected calendars:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConnectedCalendars();
  }, []);

  const handleDisconnect = async (calendarId) => {
    try {
      setIsDisconnecting(true);
      const response = await fetch('/api/google/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ calendarId }),
      });

      if (response.ok) {
        await loadConnectedCalendars();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        const error = await response.json();
        console.error('Failed to disconnect calendar:', error);
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-light-text/50 dark:text-dark-text/50">
          Loading connected calendars...
        </div>
      </div>
    );
  }

  if (connectedCalendars.length === 0) {
    return (
      <div className="text-center py-8 text-light-text/50 dark:text-dark-text/50">
        <p className="text-sm">No calendars connected yet.</p>
        <p className="text-xs mt-2">
          Connect your Google Calendar to sync events automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {connectedCalendars.map((calendar) => (
        <CalendarConnectionItem
          key={calendar.id}
          calendar={calendar}
          onDisconnect={handleDisconnect}
          isDisconnecting={isDisconnecting}
        />
      ))}
    </div>
  );
};

export default CalendarConnectionList;


