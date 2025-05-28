'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { format, isSameDay } from 'date-fns';
import { Return } from '../assets/icons/Return';

const RepeatTaskEditModal = ({ 
  isOpen, 
  task,
  taskTitle, 
  onClose, 
  onEditConfirm,
  originalTask,
  draggedTask,
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

    // Create a clean task object with just the essential properties
    const updatedTask = {
      ...draggedTask,
      // Core task properties - ensure we have fresh Date objects
      // For tasks, if no specific time is set, use the scheduled date as all-day
      start: draggedTask?.start ? new Date(draggedTask.start) : 
             (draggedTask?.scheduledDate ? new Date(draggedTask.scheduledDate) : new Date()),
      end: draggedTask?.end ? new Date(draggedTask.end) : 
           (draggedTask?.scheduledDate ? new Date(draggedTask.scheduledDate) : new Date()),
      // Series properties based on edit scope
      repeat: editScope === 'single' ? 'none' : draggedTask.repeat,
      // Keep original seriesId, detachment happens in updateSeriesTasks
      seriesId: draggedTask.seriesId,
      // Conditionally include rruleOptions if they exist and scope is not 'single'
      ...(draggedTask.repeat === 'custom' && draggedTask.rruleOptions && editScope !== 'single' && { rruleOptions: draggedTask.rruleOptions }),
      isRepeat: draggedTask.isRepeat, // Preserve original isRepeat value
      // Operation metadata
      _editScope: editScope,
      _timeChange: {
        startDiff: (draggedTask?.start && originalTask?.start) ? new Date(draggedTask.start).getTime() - new Date(originalTask.start).getTime() : 0,
        endDiff: (draggedTask?.end && originalTask?.end) ? new Date(draggedTask.end).getTime() - new Date(originalTask.end).getTime() : 0
      },
      _originalTask: {
        ...originalTask,
        start: originalTask?.start ? new Date(originalTask.start) : 
               (originalTask?.scheduledDate ? new Date(originalTask.scheduledDate) : new Date()),
        end: originalTask?.end ? new Date(originalTask.end) : 
             (originalTask?.scheduledDate ? new Date(originalTask.scheduledDate) : new Date())
      },
      // Operation flags - ensure these are explicitly set as booleans
      _isDragging: draggedTask._isDragging === true,
      _isResizing: draggedTask._isResizing === true,
      _updateSeries: editScope === 'all',
      _preserveRepeat: editScope !== 'single',
      // Preserve exact position for 'this task' scope
      _exactPosition: {
        start: draggedTask?.start ? new Date(draggedTask.start) : 
               (draggedTask?.scheduledDate ? new Date(draggedTask.scheduledDate) : new Date()),
        end: draggedTask?.end ? new Date(draggedTask.end) : 
             (draggedTask?.scheduledDate ? new Date(draggedTask.scheduledDate) : new Date())
      },
      // For 'this task' scope, ensure we're using the dragged task's exact position
      ...(editScope === 'single' && {
        _detachedTask: true,
        _preserveExactPosition: true
      })
    };

    console.log('RepeatTaskEditModal - Confirming edit with flags:', {
      id: updatedTask.id,
      isDragging: updatedTask._isDragging,
      isResizing: updatedTask._isResizing,
      editScope,
      start: updatedTask.start.toISOString(),
      end: updatedTask.end.toISOString(),
      exactPosition: updatedTask._exactPosition ? {
        start: updatedTask._exactPosition.start.toISOString(),
        end: updatedTask._exactPosition.end.toISOString()
      } : null
    });

    // Always update through onEditConfirm to ensure consistent handling
    onEditConfirm({
      scope: editScope,
      task: updatedTask
    });
    
    // Close the modal
    onClose();
  }, [editScope, draggedTask, originalTask, onEditConfirm, onClose, isEditOperation, commandBarRef]);

  // Don't render anything if not open or if we don't have the tasks
  if (!isOpen || !originalTask || !draggedTask) return null;

  // Format the times for display
  const formatTimeRange = (start, end, isAllDay = false) => {
    try {
      // For all-day tasks, return "All day"
      if (isAllDay) {
        return 'All day';
      }
      
      // Ensure we have valid Date objects
      const startDate = start instanceof Date ? start : new Date(start);
      const endDate = end instanceof Date ? end : new Date(end);
      
      // Check if dates are valid
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return 'All day'; // Default to all day for invalid times
      }
      
      // Check if this appears to be an all-day event (same date for start and end)
      if (isSameDay(startDate, endDate) && 
          startDate.getHours() === 0 && startDate.getMinutes() === 0 &&
          endDate.getHours() === 0 && endDate.getMinutes() === 0) {
        return 'All day';
      }
      
      return `${format(startDate, 'h:mma')}–${format(endDate, 'h:mma')}`;
    } catch (error) {
      console.error('Error formatting time range:', error);
      return 'All day'; // Default to all day for errors
    }
  };

  // Check if this is a task (all-day by default)
  const isTaskAllDay = originalTask?.isTask || draggedTask?.isTask || 
                      originalTask?.allDay || originalTask?.isAllDay ||
                      draggedTask?.allDay || draggedTask?.isAllDay;
  
  const originalTimeStr = formatTimeRange(originalTask?.start, originalTask?.end, isTaskAllDay);
  const newTimeStr = formatTimeRange(draggedTask?.start, draggedTask?.end, isTaskAllDay);
  
  // Determine if times are different (only for drag/resize operations)
  // For all-day tasks, we only care about date changes, not time changes
  const timesAreDifferent = 
    !isEditOperation && 
    originalTask?.start && draggedTask?.start && originalTask?.end && draggedTask?.end &&
    (isTaskAllDay ? 
      // For all-day tasks, compare dates only
      !isSameDay(new Date(originalTask.start), new Date(draggedTask.start)) ||
      !isSameDay(new Date(originalTask.end), new Date(draggedTask.end))
      :
      // For timed events, compare exact times
      (new Date(originalTask.start).getTime() !== new Date(draggedTask.start).getTime() || 
       new Date(originalTask.end).getTime() !== new Date(draggedTask.end).getTime())
    );
  
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
          Edit repeat task <span className="!font-semibold">"{taskTitle || 'Untitled'}"</span>
        </h2>

        <div className="space-y-4 px-8 mb-6">
          {/* Single task option */}
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
              This task
            </span>
          </label>

          {/* Future tasks option */}
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
              This and following tasks
            </span>
          </label>

          {/* All tasks option */}
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
              All tasks
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

export default RepeatTaskEditModal;