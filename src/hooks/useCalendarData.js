// /Users/tommysmith/Documents/chrono/src/hooks/useCalendarData.js
import { useState, useEffect, useCallback } from 'react';
import {
  loadViews,
  saveViews,
  loadActiveViewIds,
  saveActiveViewIds,
  getDefaultViewId,
} from '../utils/viewUtils';

const EVENTS_STORAGE_KEY = 'calendarEvents';

// Helper to generate unique IDs (can be replaced with a more robust solution like uuid if needed)
const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useCalendarData = () => {
  const [views, setViews] = useState([]);
  const [activeViewIds, setActiveViewIds] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load and migration
  useEffect(() => {
    const initialViews = loadViews();
    const initialActiveViewIds = loadActiveViewIds();
    
    let migratedEvents = false;
    let eventsData = [];
    try {
      const storedEvents = localStorage.getItem(EVENTS_STORAGE_KEY);
      eventsData = storedEvents ? JSON.parse(storedEvents) : [];
      if (!Array.isArray(eventsData)) eventsData = []; // Ensure it's an array

      const defaultViewId = getDefaultViewId();
      eventsData = eventsData.map(event => {
        if (typeof event.viewId === 'undefined' || event.viewId === null) {
          migratedEvents = true;
          return { ...event, viewId: defaultViewId };
        }
        return event;
      });

      if (migratedEvents) {
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(eventsData));
        console.log('Events migrated to include viewId.');
      }
    } catch (error) {
      console.error("Error loading or migrating events from localStorage:", error);
      eventsData = []; // Fallback to empty array on error
    }

    setViews(initialViews);
    setActiveViewIds(initialActiveViewIds);
    setAllEvents(eventsData);
    setIsLoading(false);
  }, []);

  // --- View Management ---
  const addView = useCallback((name) => {
    if (!name.trim()) {
      alert("View name cannot be empty."); // Or handle error more gracefully
      return;
    }
    const newView = { id: generateId(), name: name.trim() };
    setViews(prevViews => {
      const updatedViews = [...prevViews, newView];
      saveViews(updatedViews);
      return updatedViews;
    });
  }, []);

  const renameView = useCallback((id, newName) => {
    if (!newName.trim()) {
      alert("View name cannot be empty.");
      return;
    }
    setViews(prevViews => {
      const updatedViews = prevViews.map(view =>
        view.id === id ? { ...view, name: newName.trim() } : view
      );
      saveViews(updatedViews);
      return updatedViews;
    });
  }, []);

  const deleteView = useCallback((idToDelete) => {
    if (idToDelete === getDefaultViewId()) {
        alert("The default 'Personal' view cannot be deleted."); // Or handle more gracefully
        return;
    }

    setViews(prevViews => {
      const updatedViews = prevViews.filter(view => view.id !== idToDelete);
      saveViews(updatedViews);
      return updatedViews;
    });

    setActiveViewIds(prevActive => {
      const updatedActive = prevActive.filter(activeId => activeId !== idToDelete);
      saveActiveViewIds(updatedActive);
      return updatedActive;
    });

    // Reassign events from the deleted view to the default view
    const defaultViewId = getDefaultViewId();
    setAllEvents(prevEvents => {
        const updatedEvents = prevEvents.map(event => {
            if (event.viewId === idToDelete) {
                return { ...event, viewId: defaultViewId };
            }
            return event;
        });
        localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedEvents));
        return updatedEvents;
    });
  }, []);

  const toggleView = useCallback((id) => {
    setActiveViewIds(prevActive => {
      const newActiveViewIds = prevActive.includes(id)
        ? prevActive.filter(activeId => activeId !== id)
        : [...prevActive, id];
      saveActiveViewIds(newActiveViewIds);
      return newActiveViewIds;
    });
  }, []);

  // --- Event Management (Centralized) ---
  const updateEventsInStore = useCallback((updatedEvents) => {
    setAllEvents(updatedEvents);
    localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(updatedEvents));
  }, []);
  
  const addEvent = useCallback((newEventData) => {
    // Ensure new event has a viewId, default if not provided
    const eventWithViewId = {
      ...newEventData,
      id: newEventData.id || generateId(), // Ensure ID if not present
      viewId: newEventData.viewId || (activeViewIds.length > 0 ? activeViewIds[0] : getDefaultViewId()),
    };
    const updatedEvents = [...allEvents, eventWithViewId];
    updateEventsInStore(updatedEvents);
    return eventWithViewId; // Return the full event object
  }, [allEvents, activeViewIds, updateEventsInStore]);

  const updateEvent = useCallback((eventId, updatedProperties) => {
    let eventUpdated = false;
    const updatedEvents = allEvents.map(event => {
      if (event.id === eventId) {
        eventUpdated = true;
        return { ...event, ...updatedProperties };
      }
      return event;
    });
    if (eventUpdated) {
      updateEventsInStore(updatedEvents);
    }
    return eventUpdated;
  }, [allEvents, updateEventsInStore]);

  const deleteEvent = useCallback((eventId) => {
    const updatedEvents = allEvents.filter(event => event.id !== eventId);
    updateEventsInStore(updatedEvents);
  }, [allEvents, updateEventsInStore]);
  
  const setCalendarEvents = useCallback((events) => { // For bulk updates if necessary
    updateEventsInStore(events);
  }, [updateEventsInStore]);


  // --- Filtered Events for Display ---
  const getFilteredEvents = useCallback(() => {
    if (isLoading || activeViewIds.length === 0) {
      return [];
    }
    return allEvents.filter(event => activeViewIds.includes(event.viewId));
  }, [allEvents, activeViewIds, isLoading]);

  return {
    views,
    activeViewIds,
    allEvents, // Raw list of all events
    isLoading,
    
    addView,
    renameView,
    deleteView,
    toggleView,
    
    addEvent,
    updateEvent,
    deleteEvent,
    setCalendarEvents, // Expose this for broader compatibility during refactor

    getFilteredEvents, // Function to get events based on active views
  };
};
