'use client';

import React from 'react';

const DeleteEventModal = ({ isOpen, eventTitle, onClose, onDelete }) => {
  const [deleteAll, setDeleteAll] = React.useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-[9999]"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[13px] shadow-md w-full max-w-md p-6 z-[9999]">
        <h2 className="text-md text-light-text dark:text-dark-text mb-6">
          Delete repeat event "{eventTitle}"
        </h2>

        <div className="space-y-4 mb-8">
          <label className="flex items-center gap-3 cursor-pointer">
            <div 
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${!deleteAll 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => setDeleteAll(false)}
            >
              {!deleteAll && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-light-text/50 text-sm dark:text-dark-text/50">
              This event
            </span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <div 
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${deleteAll 
                  ? 'border-primary bg-primary' 
                  : 'border-light-border dark:border-dark-border'
                }`}
              onClick={() => setDeleteAll(true)}
            >
              {deleteAll && (
                <div className="w-2 h-2 rounded-full bg-white" />
              )}
            </div>
            <span className="text-light-text/50 text-sm dark:text-dark-text/50">
              All events
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-light-text/50 text-sm dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text rounded-[9px]"
          >
            Cancel
          </button>
          <button
            onClick={() => onDelete(deleteAll)}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-sm text-white rounded-[9px]"
          >
            Delete event
          </button>
        </div>
      </div>
    </>
  );
};

export default DeleteEventModal;
