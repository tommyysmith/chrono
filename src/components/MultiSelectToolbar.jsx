'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function MultiSelectToolbar({ 
  isOpen, 
  selectedCount, 
  onClearSelection, 
  onComplete, 
  onSchedule, 
  onPriority, 
  onTag 
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed bottom-[68px] left-0 right-0 flex items-center justify-between px-4 pb-2"
          style={{height: '52px'}}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex items-center gap-2 text-sm text-light-text dark:text-dark-text">
            <button
              onClick={onClearSelection}
              className="text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text"
            >
              ←
            </button>
            <span className="font-medium">{selectedCount} selected</span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onComplete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-500 hover:bg-green-600 text-white rounded-md"
            >
              ✓ Done
            </button>
            <button
              onClick={onSchedule}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-500 hover:bg-blue-600 text-white rounded-md"
            >
              📅 Schedule
            </button>
            <button
              onClick={onPriority}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-md"
            >
              ⚡ Priority
            </button>
            <button
              onClick={onTag}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-purple-500 hover:bg-purple-600 text-white rounded-md"
            >
              🏷️ Tag
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}