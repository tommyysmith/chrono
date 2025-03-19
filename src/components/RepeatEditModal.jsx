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
    
    // Call onEditConfirm with the selected scope and event data
    onEditConfirm({
      scope: editScope,
      event: {
        ...draggedEvent,
        repeat: editScope === 'single' ? 'none' : draggedEvent.repeat,
        seriesId: editScope === 'single' ? null : draggedEvent.seriesId,
        isRepeat: editScope !== 'single',
        _editScope: editScope, // Add internal property for scope
        _seriesUpdate: editScope === 'all' // Add internal property for series update
      }
    });
    
    // Close the modal
    onClose();
  }, [editScope, draggedEvent, onEditConfirm, onClose]);

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
      <div className="relative bg-dark-bg-lighter dark:bg-dark-bg border border-dark-border dark:border-dark-border rounded-[9px] shadow-md w-full max-w-md p-6">
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
              className={`w-5 h-5 rounded-full border-2 border-white/30 dark:border-white flex items-center justify-center
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
              className={`w-5 h-5 rounded-full border-2 border-white/30 dark:border-white flex items-center justify-center
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
              className={`w-5 h-5 rounded-full border-2 border-white/30 dark:border-white flex items-center justify-center
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
            <div className="flex items-center gap-3 text-sm text-light-text/50 dark:text-dark-text/50">
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
            className="px-3 py-2 bg-primary hover:bg-primary/90 text-sm font-semibold text-white rounded-[5px]"
          >
            {continueButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepeatEditModal;
