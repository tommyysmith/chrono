'use client';

import React, { useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Return } from '../assets/icons/Return';

const SendUpdateModal = ({ 
  isOpen, 
  eventTitle, 
  originalTime,
  newTime,
  onClose, 
  onDiscard, 
  onSendUpdate 
}) => {
  const formatTimeRange = (start, end) => {
    if (!start || !end) return '';
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    return `${format(startDate, 'h:mma')}–${format(endDate, 'h:mma')}`;
  };

  // Handle keyboard shortcuts when modal is open
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onDiscard();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      onSendUpdate();
    }
  }, [onDiscard, onSendUpdate]);

  useEffect(() => {
    if (!isOpen) return;

    // Add event listener with capture to ensure it runs before other listeners
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const originalTimeStr = originalTime ? formatTimeRange(originalTime.start, originalTime.end) : '';
  const newTimeStr = newTime ? formatTimeRange(newTime.start, newTime.end) : '';
  const timesAreDifferent = originalTimeStr !== newTimeStr;

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
          Send update for <span className="!font-semibold">"{eventTitle || 'Untitled'}"</span>?
        </h2>

        <p className="text-xs text-light-text/70 dark:text-dark-text/70 px-8 mb-6">
          This event has other participants. Would you like to send them an update about the changes?
        </p>

        {/* Time preview - Only show when times actually changed */}
        {timesAreDifferent && (
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
            onClick={onDiscard}
            className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
          >
            <span className="flex items-center pl-1 pr-3">Discard</span>
            <div className="flex flex-row h-[20px] items-center outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border bg-black/5 dark:bg-white/5 px-1.5 rounded-[5px]">
              <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
            </div>
          </button>
          <button
            type="button"
            onClick={onSendUpdate}
            className="px-2 h-[36px] flex flex-row bg-primary text-xs bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] items-center"
          >
            <span className="font-semibold pl-1 pr-3 font-['Inter'] text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)]">
              Send update
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

export default SendUpdateModal;
