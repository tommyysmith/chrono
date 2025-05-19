'use client';

import React from 'react';

const DeleteTaskModal = ({ isOpen, taskTitle, onClose, onDelete }) => {
  // Use a state variable to store the selected scope
  const [deleteScope, setDeleteScope] = React.useState('single'); // Default to 'single'

  if (!isOpen) return null;

  // Handler for the Delete button
  const handleDeleteConfirm = () => {
    onDelete(deleteScope); // Pass the selected scope string
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 dark:bg-black/50"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-light-bg dark:bg-dark-bg-lighter outline outline-light-border dark:outline-dark-border rounded-[9px] shadow-2xl w-full max-w-lg">
        <h2 className="text-sm px-8 pt-8 text-light-text dark:text-dark-text mb-6">
          Delete recurring task <span className="!font-semibold">"{taskTitle || 'Untitled'}"</span>
        </h2>

        <div className="space-y-4 px-8 mb-6">
          {/* Single task option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="deleteScope"
              value="single"
              checked={deleteScope === 'single'}
              onChange={() => setDeleteScope('single')}
              className="hidden"
            />
            <div 
              className={`w-4 h-4 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center
                ${deleteScope === 'single' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => setDeleteScope('single')}
            >
              {deleteScope === 'single' && (
                <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
              )}
            </div>
            <span className="text-light-text dark:text-dark-text text-xs">
              This task only
            </span>
          </label>

          {/* This and future tasks option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="deleteScope"
              value="future"
              checked={deleteScope === 'future'}
              onChange={() => setDeleteScope('future')}
              className="hidden"
            />
            <div 
              className={`w-4 h-4 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center
                ${deleteScope === 'future' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => setDeleteScope('future')}
            >
              {deleteScope === 'future' && (
                <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
              )}
            </div>
            <span className="text-light-text dark:text-dark-text text-xs">
              This and future tasks
            </span>
          </label>

          {/* All tasks option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="deleteScope"
              value="all"
              checked={deleteScope === 'all'}
              onChange={() => setDeleteScope('all')}
              className="hidden"
            />
            <div 
              className={`w-4 h-4 rounded-full border-2 border-black/10 dark:border-white/10 flex items-center justify-center
                ${deleteScope === 'all' 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => setDeleteScope('all')}
            >
              {deleteScope === 'all' && (
                <div className="w-2 h-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
              )}
            </div>
            <span className="text-light-text dark:text-dark-text text-xs">
              All tasks in this series
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex px-8 pb-8 justify-end gap-3">
          <button
            onClick={onClose}
            className="flex items-center flex-row px-4 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
          >
            Cancel
          </button>
          <button
            onClick={handleDeleteConfirm}
            className="px-4 h-[36px] bg-red-500 text-xs bg-gradient-to-b from-red-500 to-red-600 hover:bg-gradient-to-b hover:from-red-600 hover:to-red-700 rounded-[5px] items-center gap-2"
          >
            <span className="font-semibold font-['Inter'] text-dark-text [text-shadow:_0px_2px_6px_rgb(0_0_0_/_0.20)]">
              Delete task
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteTaskModal;
