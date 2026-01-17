'use client';

import { memo } from 'react';
import { useCommandBar, VIEW_MODES } from '../CommandBarContext';
import { Add } from '../../../assets/icons/Add';
import { Chevron } from '../../../assets/icons/Chevron';
import { ArrowAlt } from '../../../assets/icons/ArrowAlt';
import { Completed } from '../../../assets/icons/Completed';
import { Calendar as CalendarIcon } from '../../../assets/icons/Calendar';
import { Shift } from '../../../assets/icons/Shift';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

function DefaultView({ onPrevious, onNext, onToday }) {
  const { openTaskForm, openEventForm, openGoToDate } = useCommandBar();

  return (
    <div className="flex items-center gap-2">
      {/* Add New Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex group py-4 px-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50">
            <Add className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
            <span className="text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text font-semibold text-sm">
              Add new
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-44 flex flex-col p-1 mb-2 bg-light-bg dark:bg-dark-bg-lighter outline outline-1 outline-offset-0 outline-light-border dark:outline-dark-border rounded-[9px] shadow-lg"
          align="start"
          sideOffset={2}
        >
          <button
            onClick={() => openTaskForm()}
            className="group w-full flex items-center justify-between gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
          >
            <div className="flex flex-row gap-2 items-center">
              <Completed className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
              <span className="group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium">
                Task
              </span>
            </div>
            <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
              <span className="text-[10px] font-semibold flex flex-row items-center gap-1 tracking-wide text-light-text/50 dark:text-dark-text/50">
                <Shift className="w-2.5 h-2.5" />+<span className="pl-[1px] pr-[1px]">T</span>
              </span>
            </div>
          </button>
          <button
            onClick={() => openEventForm()}
            className="group w-full flex items-center justify-between gap-2 px-2 py-2 text-sm text-light-text/50 dark:text-dark-text/50 hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px] transition-colors"
          >
            <div className="flex flex-row gap-2 items-center">
              <CalendarIcon className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" />
              <span className="group-hover:text-light-text dark:group-hover:text-dark-text group-hover:font-medium dark:group-hover:font-medium">
                Event
              </span>
            </div>
            <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
              <span className="text-[10px] font-semibold flex flex-row items-center gap-1 tracking-wide text-light-text/50 dark:text-dark-text/50">
                <Shift className="w-2.5 h-2.5" />+<span className="pl-[1px] pr-[1px]">E</span>
              </span>
            </div>
          </button>
        </PopoverContent>
      </Popover>

      {/* Divider */}
      <div className="h-[24px] w-[1px] bg-light-border dark:bg-dark-border" />

      {/* Navigation */}
      <div className="flex items-center py-4 px-4 gap-2">
        <Chevron
          className="w-4 h-4 rotate-180 text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text cursor-pointer"
          onClick={onPrevious}
        />
        <span
          className="text-light-text/50 select-none dark:text-dark-text/50 hover:text-primary dark:hover:text-primary font-semibold text-sm cursor-pointer"
          onClick={onToday}
        >
          Today
        </span>
        <Chevron
          className="w-4 h-4 text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text cursor-pointer"
          onClick={onNext}
        />
      </div>

      {/* Divider */}
      <div className="h-[24px] w-[1px] bg-light-border dark:bg-dark-border" />

      {/* Go to Date */}
      <button
        onClick={openGoToDate}
        className="group flex py-4 px-4 items-center gap-2 text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors cursor-pointer"
      >
        <ArrowAlt className="w-4 h-4 group-hover:text-light-text dark:group-hover:text-dark-text" fill="none">
          <path
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </ArrowAlt>
        <span className="group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50 font-semibold text-sm">
          Go to date
        </span>
      </button>
    </div>
  );
}

export default memo(DefaultView);
