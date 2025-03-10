'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format } from 'date-fns';

const RepeatEditModal = ({ 
  isOpen, 
  eventTitle, 
  onClose, 
  onEditConfirm,
  originalEvent,
  draggedEvent,
  isEditOperation = false  // Flag to determine if this is a regular edit operation
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
    // Prevent double-clicks and race conditions
    if (hasSubmitted.current) return;
    hasSubmitted.current = true;
    
    // Store the current scope value and trigger edit confirmation
    // Use queueMicrotask to ensure state updates happen in the correct order
    const scope = editScope;
    queueMicrotask(() => {
      onEditConfirm(scope);
    });
  }, [editScope, onEditConfirm]);

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
      <div className="relative bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[13px] shadow-md w-full max-w-md p-6">
        <h2 className="text-md text-light-text dark:text-dark-text mb-6">
          Edit repeat event "{eventTitle || 'Untitled'}"
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
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
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
            <span className="text-light-text dark:text-dark-text text-sm">
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
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
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
            <span className="text-light-text dark:text-dark-text text-sm">
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
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
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
            <span className="text-light-text dark:text-dark-text text-sm">
              All events
            </span>
          </label>
        </div>

        {/* Time preview - Only show for drag/resize operations when times actually changed */}
        {!isEditOperation && timesAreDifferent && (
          <div className="mb-8 px-8">
            <div className="flex items-center gap-3 text-sm text-light-text/50 dark:text-dark-text/50">
              <span>Time</span>
              <div className="flex-1 flex items-center">
                <span className="line-through">{originalTimeStr}</span>
                <span className="mx-2">→</span>
                <span className="text-light-text dark:text-dark-text">{newTimeStr}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            className="px-4 py-2 text-light-text/50 text-sm dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text rounded-[9px]"
          >
            Discard change
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-sm text-white rounded-[9px]"
          >
            {continueButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepeatEditModal;
