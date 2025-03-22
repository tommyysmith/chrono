'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';

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
    }
  }, [isOpen]);
  
  // Handle radio button selection
  const handleRadioSelect = (scope) => {
    setEditScope(scope);
  };
  
  // Handle clicking the Discard button
  const handleDiscard = () => {
    onClose();
  };
  
  // Handle the Continue editing button click
  const handleContinue = useCallback(() => {
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    
    // Make completely new objects with fresh dates to avoid any possible reference issues
    const updatedEvent = {
      ...JSON.parse(JSON.stringify(draggedEvent)), // Deep clone without Date objects
      // For single events, remove repeat properties
      repeat: editScope === 'single' ? null : draggedEvent.repeat,
      seriesId: editScope === 'single' ? null : draggedEvent.seriesId,
      isRepeat: editScope !== 'single',
      // Internal properties for handling the update
      _editScope: editScope,
      _seriesUpdate: editScope === 'all',
      // Recreate date objects to ensure they're fresh instances
      start: new Date(draggedEvent.start.getTime()),
      end: new Date(draggedEvent.end.getTime()),
      // Preserve the manipulation flag
      _isBeingManipulated: true,
      // Create fresh date objects for exact position
      _exactPosition: {
        start: new Date(draggedEvent.start.getTime()),
        end: new Date(draggedEvent.end.getTime())
      },
      // Create fresh original event with new date objects
      _originalEvent: originalEvent ? {
        ...JSON.parse(JSON.stringify(originalEvent)),
        start: new Date(originalEvent.start.getTime()),
        end: new Date(originalEvent.end.getTime())
      } : null
    };

    console.log('RepeatEditModal - Confirming event update:', updatedEvent);

    // For inline edits (drag/resize), update directly
    if (!isEditOperation) {
      onEditConfirm({
        scope: editScope,
        event: updatedEvent
      });
    } else {
      // For double-click edits, open command bar
      if (commandBarRef?.current) {
        commandBarRef.current.openForEdit(updatedEvent);
      }
    }
    
    // Close the modal
    onClose();
  }, [editScope, draggedEvent, originalEvent, onEditConfirm, onClose, isEditOperation, commandBarRef]);

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
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-dark-bg-lighter dark:bg-dark-bg dark:bg-gradient-to-t from-white/0 to-white/[0.035] to-90% outline outline-dark-border dark:outline-dark-border rounded-[9px] shadow-md w-full max-w-md p-6">
        <h2 className="text-md text-dark-text dark:text-dark-text mb-6">
          Edit repeat event <span className="!font-semibold">"{eventTitle || 'Untitled'}"</span>
        </h2>

        <div className="space-y-4 mb-6">
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
              className={`w-5 h-5 rounded-full border-2 border-white/30 dark:border-white/30 flex items-center justify-center
                ${editScope === 'single' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => handleRadioSelect('single')}
            >
              {editScope === 'single' && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-dark-text dark:text-dark-text text-sm">
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
              className={`w-5 h-5 rounded-full border-2 border-white/30 dark:border-white/30 flex items-center justify-center
                ${editScope === 'future' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => handleRadioSelect('future')}
            >
              {editScope === 'future' && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-dark-text dark:text-dark-text text-sm">
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
              className={`w-5 h-5 rounded-full border-2 border-white/30 dark:border-white/30 flex items-center justify-center
                ${editScope === 'all' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => handleRadioSelect('all')}
            >
              {editScope === 'all' && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-dark-text dark:text-dark-text text-sm">
              All events
            </span>
          </label>
        </div>

        {/* Time preview - Only show for drag/resize operations when times actually changed */}
        {!isEditOperation && timesAreDifferent && (
          <div className="mb-8 px-8">
            <div className="flex items-center gap-3 text-sm text-dark-text/50 dark:text-dark-text/50">
              <span>Time</span>
              <div className="flex-1 flex items-center">
                <span className="line-through">{originalTimeStr}</span>
                <span className="mx-2">→</span>
                <span className="text-dark-text font-medium dark:text-dark-text">{newTimeStr}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            className="px-4 py-2 text-dark-text/50 text-sm dark:text-dark-text/50 hover:text-dark-text hover:font-medium dark:hover:text-dark-text rounded-[9px]"
          >
            Discard change
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="px-3 py-2 bg-primary text-sm bg-gradient-to-b hover:bg-gradient-to-b hover:from-black/0 hover:to-black/50 from-black/0 to-black/30 rounded-[9px] shadow-[inset_0px_2px_0px_0px_rgba(255,255,255,0.08)] shadow-[inset_0px_2px_6px_0px_rgba(255,255,255,0.16)] shadow-[inset_0px_-2px_6px_0px_rgba(0,0,0,0.16)] outline outline-1 outline-offset-[-1px] outline-orange-700 inline-flex justify-end items-center gap-2"
          >
            <span className="font-semibold font-['Inter'] [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)]">
            {continueButtonText}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepeatEditModal;
