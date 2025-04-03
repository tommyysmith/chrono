'use client';

import React, { useState, useEffect } from 'react';
import RecurrenceEditor from './RecurrenceEditor';
import { Button } from '@/components/ui/button';
import { Return } from '../assets/icons/Return';
import { Repeat } from '../assets/icons/Repeat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function RecurrenceModal({ isOpen, onOpenChange, initialValue, onSave, startDate }) {
  // Internal state to manage the options while the modal is open
  const [currentOptions, setCurrentOptions] = useState(initialValue);

  // Update internal state if the initial value changes while modal might be closing/reopening
  useEffect(() => {
    setCurrentOptions(initialValue);
  }, [initialValue, isOpen]); // Reset if initialValue changes or modal reopens

  const handleSave = () => {
    onSave?.(currentOptions);
    onOpenChange?.(false); // Close the modal
  };

  const handleCancel = () => {
    onOpenChange?.(false); // Close the modal without saving
  };

  // We need to pass the start date down to the editor for accurate previews
  const effectiveStartDate = startDate || new Date();

  // Prevent rendering the editor if the modal is closed
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] bg-light-bg dark:bg-dark-bg-lighter border border-light-border dark:border-dark-border">
        <DialogHeader className="p-8 pb-2">
          <div className="flex flex-row gap-2 items-center">
            <div className="flex justify-center items-center h-[20px] w-[20px] outline outline-1 outline-primary/20 bg-primary/10 rounded-[5px]">
              <Repeat className="h-3 w-3 text-primary" />
            </div>
            <DialogTitle className="text-light-text  dark:text-dark-text text-sm">Repeat</DialogTitle> 
          </div>
        </DialogHeader>
        
        {/* Embed the RecurrenceEditor */}
        <RecurrenceEditor
          value={currentOptions}
          onChange={setCurrentOptions} // Update internal state as editor changes
          startDate={effectiveStartDate} // Pass start date for preview
        />

        <DialogFooter>
          {/* Apply styles from RepeatEditModal footer */}
          <button
            onClick={handleCancel}
            className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
          >
            <span className="flex items-center pl-1 pr-3 ">Cancel</span>
            <div className="flex flex-row h-[20px] items-center outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border bg-black/5 dark:bg-white/5 px-1.5 rounded-[5px]">
            <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-2 h-[36px] flex flex-row bg-primary text-xs bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] items-center"
          >
            <span className="font-semibold pl-1 pr-3 font-['Inter'] text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)]">
              Save Rule
            </span>
            <div className={`flex items-center text-white px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border bg-white/10 p-1 rounded-[5px]`}>
              <Return className="w-3 h-3" />
            </div>
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
