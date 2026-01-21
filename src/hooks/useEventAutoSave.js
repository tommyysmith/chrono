'use client';

import { useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

const DEBOUNCE_DELAY = 400;
const UNDO_WINDOW = 5000;

export function useEventAutoSave({
  onUpdateEvent,
  onCreateEvent,
  editingEvent,
  setRepeatEditModalState,
  close,
}) {
  const debounceTimerRef = useRef(null);
  const undoStackRef = useRef([]);
  const lastSavedStateRef = useRef(null);
  const isNewEventRef = useRef(false);
  const hasCreatedEventRef = useRef(false);
  const pendingEventDataRef = useRef(null);

  useEffect(() => {
    isNewEventRef.current = !editingEvent?.id || editingEvent?.isDraft;
    hasCreatedEventRef.current = false;
    lastSavedStateRef.current = editingEvent ? { ...editingEvent } : null;
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [editingEvent?.id]);

  const pushUndoState = useCallback((previousState, currentState, eventId) => {
    const undoEntry = {
      previousState,
      currentState,
      eventId,
      timestamp: Date.now(),
    };
    undoStackRef.current.push(undoEntry);
    
    setTimeout(() => {
      undoStackRef.current = undoStackRef.current.filter(
        entry => Date.now() - entry.timestamp < UNDO_WINDOW
      );
    }, UNDO_WINDOW + 100);
  }, []);

  const undo = useCallback(() => {
    const lastEntry = undoStackRef.current.pop();
    if (!lastEntry) {
      toast.info('Nothing to undo');
      return false;
    }

    if (Date.now() - lastEntry.timestamp > UNDO_WINDOW) {
      toast.error('Undo window expired');
      return false;
    }

    onUpdateEvent?.(lastEntry.previousState);
    lastSavedStateRef.current = lastEntry.previousState;
    toast.success('Change undone');
    return true;
  }, [onUpdateEvent]);

  const saveEvent = useCallback((eventData, options = {}) => {
    const { showToast = true, isRecurring = false } = options;

    if (isRecurring && setRepeatEditModalState) {
      setRepeatEditModalState({
        isOpen: true,
        event: eventData,
        draggedEvent: eventData,
        originalEvent: lastSavedStateRef.current,
        isEditOperation: true,
      });
      return;
    }

    const previousState = lastSavedStateRef.current;
    
    if (isNewEventRef.current && !hasCreatedEventRef.current) {
      hasCreatedEventRef.current = true;
      onCreateEvent?.(eventData);
      lastSavedStateRef.current = eventData;
      isNewEventRef.current = false;
      
      if (showToast) {
        toast.success('Event created', {
          action: {
            label: 'Undo',
            onClick: () => {
              onUpdateEvent?.({ ...eventData, _shouldDelete: true });
              hasCreatedEventRef.current = false;
              isNewEventRef.current = true;
              lastSavedStateRef.current = null;
            },
          },
        });
      }
    } else if (eventData.id) {
      if (previousState) {
        pushUndoState(previousState, eventData, eventData.id);
      }
      
      onUpdateEvent?.(eventData);
      lastSavedStateRef.current = eventData;
      
      if (showToast) {
        toast.success('Event updated', {
          action: {
            label: 'Undo',
            onClick: undo,
          },
        });
      }
    }
  }, [onCreateEvent, onUpdateEvent, setRepeatEditModalState, pushUndoState, undo]);

  const debouncedSave = useCallback((eventData, options = {}) => {
    pendingEventDataRef.current = eventData;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (pendingEventDataRef.current) {
        saveEvent(pendingEventDataRef.current, options);
        pendingEventDataRef.current = null;
      }
    }, DEBOUNCE_DELAY);
  }, [saveEvent]);

  const cancelPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingEventDataRef.current = null;
  }, []);

  const flushPendingSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (pendingEventDataRef.current) {
      saveEvent(pendingEventDataRef.current, { showToast: false });
      pendingEventDataRef.current = null;
    }
  }, [saveEvent]);

  const discardNewEvent = useCallback(() => {
    cancelPendingSave();
    if (editingEvent?.isDraft) {
      onUpdateEvent?.({ ...editingEvent, _shouldDelete: true });
    }
    close?.();
  }, [cancelPendingSave, editingEvent, onUpdateEvent, close]);

  const shouldCreateEvent = useCallback((title) => {
    return isNewEventRef.current && !hasCreatedEventRef.current && title?.trim();
  }, []);

  const isNewEvent = useCallback(() => {
    return isNewEventRef.current && !hasCreatedEventRef.current;
  }, []);

  const hasUnsavedChanges = useCallback(() => {
    return pendingEventDataRef.current !== null;
  }, []);

  return {
    debouncedSave,
    saveEvent,
    undo,
    cancelPendingSave,
    flushPendingSave,
    discardNewEvent,
    shouldCreateEvent,
    isNewEvent,
    hasUnsavedChanges,
    lastSavedState: lastSavedStateRef.current,
  };
}
