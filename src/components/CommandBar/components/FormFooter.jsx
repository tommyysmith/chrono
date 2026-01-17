'use client';

import { memo } from 'react';
import { Return } from '../../../assets/icons/Return';

function FormFooter({
  activeTab,
  onDiscard,
  onSave,
  saveDisabled,
  saveLabel,
  isEditing,
}) {
  const buttonLabel = isEditing
    ? activeTab === 'task' ? 'Edit task' : 'Edit event'
    : activeTab === 'task' ? 'Add task' : 'Add event';

  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex items-center justify-end pb-4"
      style={{ height: '68px' }}
    >
      {/* Buttons on the right */}
      <div className="flex items-center gap-2">
        <button
          onClick={onDiscard}
          className="flex items-center flex-row px-2 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
        >
          <span className="flex items-center pl-1 pr-3">Discard</span>
          <div className="flex flex-row h-[20px] items-center bg-black/5 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 px-1.5 rounded-[5px]">
            <span className="text-[10px] tracking-wide text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
        </button>

        <button
          onClick={onSave}
          disabled={saveDisabled}
          className={`px-2 w-[120px] justify-center py-2 text-xs flex items-center flex-row font-semibold rounded-[5px] transition-colors ${
            !saveDisabled
              ? 'bg-gradient-to-b from-[#ff7a00] to-[#ea7100] hover:bg-gradient-to-b hover:from-[#ea7100] hover:to-[#d66600] rounded-[5px] text-dark-text dark:text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)] shadow-sm'
              : 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed'
          }`}
          style={{ minWidth: '100px' }}
        >
          <span className="text-xs pl-1 pr-3" style={{ minWidth: '60px', display: 'inline-block' }}>
            {saveLabel || buttonLabel}
          </span>
          <div
            className={`flex items-center px-2 outline outline-1 outline-offset-[-1px] outline-dark-border dark:outline-dark-border dark:bg-black/5 p-1 rounded-[5px] ${
              !saveDisabled
                ? 'text-dark-text dark:text-dark-text bg-white/10'
                : 'bg-black/5 text-light-text/30 dark:text-dark-text/30 bg-black/5'
            }`}
          >
            <Return className="w-3 h-3" />
          </div>
        </button>
      </div>
    </div>
  );
}

export default memo(FormFooter);
