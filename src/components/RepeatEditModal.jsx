'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, isBefore } from 'date-fns';
import { Return } from '../assets/icons/Return';

const RepeatEditModal = ({ 
  isOpen, 
  event,
  eventTitle, 
  onClose, 
  onEditConfirm,
  originalEvent,
  draggedEvent,
  isEditOperation = false,
  commandBarRef
}) => {
  const [editScope, setEditScope] = useState('single');
  const hasSubmitted = useRef(false);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setEditScope('single');
      hasSubmitted.current = false;
      
      // Debug logging for production issue
      console.log('🟡 [REPEAT-EDIT-MODAL] Modal opened with props:', {
        eventId: event?.id,
        draggedEventId: draggedEvent?.id,
        originalEventId: originalEvent?.id,
        eventTimes: event ? {
          start: event.start.toISOString(),
          end: event.end.toISOString()
        } : null,
        draggedEventTimes: draggedEvent ? {
          start: draggedEvent.start.toISOString(),
          end: draggedEvent.end.toISOString()
        } : null,
        originalEventTimes: originalEvent ? {
          start: originalEvent.start.toISOString(),
          end: originalEvent.end.toISOString()
        } : null,
        draggedEventFlags: draggedEvent ? {
          _isDragging: draggedEvent._isDragging,
          _isResizing: draggedEvent._isResizing
        } : null
      });
    }
  }, [isOpen, event, draggedEvent, originalEvent]);

  // Handle radio button selection
  const handleRadioSelect = (scope) => {
    setEditScope(scope);
  };
  
  // Handle clicking the Discard button
  const handleDiscard = useCallback(() => {
    onClose();
  }, [onClose]);
  
  // Handle the Continue editing button click
  const handleContinue = useCallback(() => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;

    // Create a clean event object with just the essential properties
    const updatedEvent = {
      ...draggedEvent,
      // Core event properties - ensure we have fresh Date objects
      start: new Date(draggedEvent.start),
      end: new Date(draggedEvent.end),
      // Series properties based on edit scope
      repeat: editScope === 'single' ? 'none' : draggedEvent.repeat,
      // Keep original seriesId, detachment happens in updateSeriesEvents
      seriesId: draggedEvent.seriesId,
      // Conditionally include rruleOptions if they exist and scope is not 'single'
      ...(draggedEvent.repeat === 'custom' && draggedEvent.rruleOptions && editScope !== 'single' && { rruleOptions: draggedEvent.rruleOptions }),
      isRepeat: editScope !== 'single',
      // Operation metadata
      _editScope: editScope,
      _timeChange: {
        startDiff: draggedEvent.start.getTime() - originalEvent.start.getTime(),
        endDiff: draggedEvent.end.getTime() - originalEvent.end.getTime()
      },
      _originalEvent: {
        ...originalEvent,
        start: new Date(originalEvent.start),
        end: new Date(originalEvent.end)
      },
      // Operation flags - ensure these are explicitly set as booleans
      _isDragging: draggedEvent._isDragging === true,
      _isResizing: draggedEvent._isResizing === true,
      _updateSeries: editScope === 'all',
      _preserveRepeat: editScope !== 'single',
      // Preserve exact position for 'this event' scope
      _exactPosition: {
        start: new Date(draggedEvent.start),
        end: new Date(draggedEvent.end)
      },
      // For 'this event' scope, ensure we're using the dragged event's exact position
      ...(editScope === 'single' && {
        _detachedEvent: true,
        _preserveExactPosition: true
      })
    };

    // Production debugging alert
    if (process.env.NODE_ENV === 'production' && editScope === 'all') {
      alert(`MODAL DEBUG: Original=${originalEvent.start.toISOString()} | Dragged=${draggedEvent.start.toISOString()} | Same=${originalEvent.start.toISOString() === draggedEvent.start.toISOString()}`);
    }

    console.log('🟡 [REPEAT-EDIT-MODAL] Confirming edit with flags:', {
      id: updatedEvent.id,
      isDragging: updatedEvent._isDragging,
      isResizing: updatedEvent._isResizing,
      editScope,
      start: updatedEvent.start.toISOString(),
      end: updatedEvent.end.toISOString(),
      exactPosition: updatedEvent._exactPosition ? {
        start: updatedEvent._exactPosition.start.toISOString(),
        end: updatedEvent._exactPosition.end.toISOString()
      } : null,
      preserveExactPosition: updatedEvent._preserveExactPosition,
      detachedEvent: updatedEvent._detachedEvent,
      originalEventTimes: {
        start: originalEvent.start.toISOString(),
        end: originalEvent.end.toISOString()
      },
      draggedEventTimes: {
        start: draggedEvent.start.toISOString(),
        end: draggedEvent.end.toISOString()
      }
    });

    // Always update through onEditConfirm to ensure consistent handling
    onEditConfirm({
      scope: editScope,
      event: updatedEvent
    });

    // For double-click edits, also open command bar
    if (isEditOperation && commandBarRef?.current) {
      commandBarRef.current.openForEdit(updatedEvent);
    }
    
    // Close the modal
    onClose();
  }, [editScope, draggedEvent, originalEvent, onEditConfirm, onClose, isEditOperation, commandBarRef]);

  // Handle keyboard shortcuts when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleDiscard();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleContinue();
      }
    };

    // Add event listener with capture to ensure it runs before CommandBar's listener
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleDiscard, handleContinue]);

  // Don't render anything if not open or if we don't have the events
  if (!isOpen || !originalEvent || !draggedEvent) return null;

  // Format the times for display
  const formatTimeRange = (start, end) => {
    return `${format(start, 'h:mma')}–${format(end, 'h:mma')}`;
  };

  const originalTimeStr = formatTimeRange(originalEvent.start, originalEvent.end);
  const newTimeStr = formatTimeRange(draggedEvent.start, draggedEvent.end);
  
  // Determine if times are different (only for drag/resize operations)
  const timesAreDifferent = 
    !isEditOperation && 
    (originalEvent.start.getTime() !== draggedEvent.start.getTime() || 
     originalEvent.end.getTime() !== draggedEvent.end.getTime());
  
  // Determine the appropriate button text based on operation type
  const continueButtonText = isEditOperation ? "Continue editing" : "Confirm edits";

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-light-bg dark:bg-dark-bg-lighter outline outline-light-border dark:outline-dark-border rounded-[9px] shadow-2xl w-full max-w-lg">
        <h2 className="text-sm px-8 pt-8 text-light-text dark:text-dark-text mb-6">
          Edit repeat event <span className="!font-semibold">"{eventTitle || 'Untitled'}"</span>
        </h2>

        <div className="space-y-4 px-8 mb-6">
          {/* Single event option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="editScope"
              value="single"
              checked={editScope === 'single'}
              onChange={() => handleRadioSelect('single')}
              className="hidden"
            />
            <div 
              className={`w-4 h-4 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center
                ${editScope === 'single' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => handleRadioSelect('single')}
            >
              {editScope === 'single' && (
                <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
              )}
            </div>
            <span className="text-light-text dark:text-dark-text text-xs">
              This event
            </span>
          </label>

          {/* Future events option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="editScope"
              value="future"
              checked={editScope === 'future'}
              onChange={() => handleRadioSelect('future')}
              className="hidden"
            />
            <div 
              className={`w-4 h-4 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center
                ${editScope === 'future' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => handleRadioSelect('future')}
            >
              {editScope === 'future' && (
                <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
              )}
            </div>
            <span className="text-light-text dark:text-dark-text text-xs">
              This and following events
            </span>
          </label>

          {/* All events option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="editScope"
              value="all"
              checked={editScope === 'all'}
              onChange={() => handleRadioSelect('all')}
              className="hidden"
            />
            <div 
              className={`w-4 h-4 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center
                ${editScope === 'all' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => handleRadioSelect('all')}
            >
              {editScope === 'all' && (
                <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
              )}
            </div>
            <span className="text-light-text dark:text-dark-text text-xs">
              All events
            </span>
          </label>
        </div>

        {/* Time preview - Only show for drag/resize operations when times actually changed */}
        {!isEditOperation && timesAreDifferent && (
          <div className="mb-8 px-8 pt-8 border-t border-light-border dark:border-dark-border">
            <div className="flex items-center gap-3 text-xs text-light-text/50 dark:text-dark-text/50">
              <span>Time</span>
              <div className="flex-1 flex items-center">
                <span className="line-through">{originalTimeStr}</span>
                <span className="mx-2">→</span>
                <span className="text-light-text font-medium dark:text-dark-text">{newTimeStr}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex px-8 pb-8 justify-end gap-3">
        <button
          onClick={handleDiscard}
          className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
        >
          <span className="flex items-center pl-1 pr-3">Discard</span>
          <div className="flex flex-row h-[20px] items-center outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border bg-black/5 dark:bg-white/5 px-1.5 rounded-[5px]">
            <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
        </button>
          <button
            type="button"
            onClick={handleContinue}
            className="px-2 h-[36px] flex flex-row bg-primary text-xs bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] items-center"
          >
            <span className="font-semibold pl-1 pr-3 font-['Inter'] text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)]">
            {continueButtonText}
            </span>
            <div className={`flex items-center text-white px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border bg-white/10 p-1 rounded-[5px]`}>
              <Return className="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepeatEditModal;
