'use client';

import { useState, memo, useCallback } from 'react';
import { useCommandBar } from '../CommandBarContext';
import { ArrowAlt } from '../../../assets/icons/ArrowAlt';
import { Check } from '../../../assets/icons/Check';
import { Lightning } from '../../../assets/icons/Lightning';
import { Tag } from '../../../assets/icons/Tag';
import { Trash } from '../../../assets/icons/Trash';
import { None } from '../../../assets/icons/None';
import { Low } from '../../../assets/icons/Low';
import { Medium } from '../../../assets/icons/Medium';
import { High } from '../../../assets/icons/High';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const PRIORITY_OPTIONS = [
  { id: 'High', label: 'High', color: '#EF4444' },
  { id: 'Medium', label: 'Medium', color: '#F59E0B' },
  { id: 'Low', label: 'Low', color: '#10B981' },
  { id: 'None', label: 'None', color: '#6B7280' }
];

const getPriorityIcon = (priorityId) => {
  switch (priorityId) {
    case 'High': return High;
    case 'Medium': return Medium;
    case 'Low': return Low;
    case 'None':
    default: return None;
  }
};

function MultiSelectToolbar({ 
  onBulkComplete, 
  onBulkPriorityChange, 
  onBulkTagChange, 
  onBulkDelete,
  tags = []
}) {
  const { selectedTaskIds, clearSelection } = useCommandBar();
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);

  const handlePrioritySelect = useCallback((priority) => {
    onBulkPriorityChange?.(priority, Array.from(selectedTaskIds));
    setIsPriorityOpen(false);
    clearSelection();
  }, [onBulkPriorityChange, selectedTaskIds, clearSelection]);

  const handleTagSelect = useCallback((tag) => {
    onBulkTagChange?.(tag, Array.from(selectedTaskIds));
    setIsTagOpen(false);
    clearSelection();
  }, [onBulkTagChange, selectedTaskIds, clearSelection]);

  const handleComplete = useCallback(() => {
    onBulkComplete?.(Array.from(selectedTaskIds));
    clearSelection();
  }, [onBulkComplete, selectedTaskIds, clearSelection]);

  const handleDelete = useCallback(() => {
    onBulkDelete?.(Array.from(selectedTaskIds));
    clearSelection();
  }, [onBulkDelete, selectedTaskIds, clearSelection]);

  return (
    <div className="flex items-center justify-between w-full py-4" data-multiselect-toolbar>
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={clearSelection}
          className="text-light-text/50 dark:text-dark-text/50 p-2 hover:bg-light-bg-lighter dark:hover:bg-white/5 rounded-[5px] hover:text-light-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
        >
          <ArrowAlt className="w-4 h-4 rotate-180" />
        </button>
        <div className="h-5 w-[1px] bg-light-border dark:bg-dark-border mr-2" />
        <span className="font-medium text-light-text/50 mr-4 dark:text-dark-text/50 text-xs">
          {selectedTaskIds.size} selected
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Done Button */}
        <button
          onClick={handleComplete}
          className="flex items-center gap-1 flex-row px-2 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
        >
          <Check className="h-3 w-3 text-green-500" />
          <span className="text-xs px-0.5">Done</span>
        </button>

        {/* Priority Popover */}
        <Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 flex-row px-2 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none">
              <Lightning className="h-3 w-3 text-blue-500" />
              <span className="text-xs px-0.5">Priority</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 focus:outline-none focus-visible:outline-none"
            align="center"
            side="top"
            sideOffset={8}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              className="flex flex-col"
            >
              {PRIORITY_OPTIONS.map((option) => {
                const IconComponent = getPriorityIcon(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className="px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 font-medium text-dark-text/70 dark:text-dark-text/70 hover:text-dark-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrioritySelect(option.id);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent
                        className={`w-4 h-4 ${option.id === 'None' ? 'text-dark-text/50 dark:text-dark-text/50' : ''}`}
                        style={option.id === 'None' ? {} : { color: option.color }}
                      />
                      <span className="text-xs">{option.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Tag Popover */}
        <Popover open={isTagOpen} onOpenChange={setIsTagOpen}>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 flex-row px-2 h-[32px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none">
              <Tag className="h-3 w-3 text-purple-500" />
              <span className="text-xs px-0.5">Tag</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[200px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50 focus:outline-none focus-visible:outline-none"
            align="center"
            side="top"
            sideOffset={8}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              role="listbox"
              className="flex flex-col"
            >
              {/* No tag option */}
              <button
                type="button"
                className="px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 font-medium text-dark-text/70 dark:text-dark-text/70 hover:text-dark-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTagSelect(null);
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0 border border-light-border dark:border-dark-border" />
                  <span className="text-xs">No tag</span>
                </div>
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 font-medium text-dark-text/70 dark:text-dark-text/70 hover:text-dark-text dark:hover:text-dark-text focus:outline-none focus-visible:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTagSelect(tag);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-xs">{tag.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-5 w-[1px] bg-light-border dark:bg-dark-border ml-2" />

        {/* Delete Button */}
        <button
          onClick={handleDelete}
          className="flex items-center gap-1 flex-row px-2 h-[32px] ml-2 font-medium shadow-sm bg-gradient-to-b from-red-500/5 to-red-500/10 hover:bg-gradient-to-b hover:from-red-500/10 hover:to-red-500/20 outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px] focus:outline-none focus-visible:outline-none"
        >
          <Trash className="h-3 w-3 text-red-500" />
          <span className="text-xs px-0.5">Delete</span>
        </button>
      </div>
    </div>
  );
}

export default memo(MultiSelectToolbar);
