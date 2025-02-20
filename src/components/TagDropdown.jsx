'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { TAG_COLORS } from '../constants/colors';
import { Tag as TagIcon } from '../assets/icons/Tag';

const TAGS = [
  { id: 'work', label: 'Work', color: '#EF4444' },
  { id: 'family', label: 'Family', color: '#3B82F6' },
  { id: 'personal', label: 'Personal', color: '#A855F7' },
  { id: 'travel', label: 'Travel', color: '#22C55E' }
];

export default function TagDropdown({ isOpen, onClose, onSelectTag, selectedTag, onClearTag, onCreateTag, tags = TAGS, searchText = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  const filteredTags = tags.filter(tag => 
    tag.label.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleCreateTag = () => {
    if (searchText && filteredTags.length === 0) {
      const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      const newTag = {
        id: searchText.toLowerCase().replace(/\s+/g, '-'),
        label: searchText,
        color: randomColor
      };
      onCreateTag(newTag);
      onSelectTag(newTag);
      onClose();
    }
  };

  return (
    <div ref={containerRef} className="relative h-[26px] flex items-center">
      <motion.div
        animate={{ width: isOpen ? 84 : selectedTag ? 84 : 26 }}
        transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
        className="relative h-[26px] overflow-hidden"
      >
        {!isOpen && !selectedTag ? (
          <button
            onClick={onSelectTag}
            className="absolute inset-0 p-1 hover:bg-light-hover dark:hover:bg-dark-hover rounded h-[26px] w-[26px] flex items-center justify-center"
          >
            <TagIcon className="w-[16px] h-[16px]" />
          </button>
        ) : !isOpen && selectedTag ? (
          <div className="absolute inset-0 rounded-[5px] border h-[26px] flex items-center justify-between pr-1" style={{ backgroundColor: `${selectedTag.color}20` }}>
            <div className="flex items-center gap-1 pl-1">
              <TagIcon className="w-[16px] h-[16px] flex-shrink-0" style={{ color: selectedTag.color }} />
              <span className="text-xs truncate">{selectedTag.label}</span>
            </div>
            <button
              onClick={onClearTag}
              className="group"
            >
              <X className="w-[12px] h-[12px] group-hover:fill-light-text dark:group-hover:fill-dark-text" />
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 bg-light-bg dark:bg-dark-bg rounded-[5px] border border-light-border dark:border-dark-border h-[26px] flex items-center">
            <div className="relative flex-1 flex items-center min-w-0">
              <TagIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-[16px] h-[16px] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Tags"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-7 pr-2 text-xs bg-transparent outline-none"
              />
            </div>
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="absolute p-1 w-[132px] backdrop-blur-lg flex flex-col gap-1 top-full left-0 min-w-full mt-1 bg-light-bg dark:bg-dark-bg-lighter rounded-[9px] border border-light-border dark:border-dark-border shadow-md overflow-hidden z-50"
          >
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => {
                    onSelectTag(tag);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1 text-xs rounded-[5px] hover:bg-black/5 dark:hover:bg-white/5`}
                >
                  <TagIcon className="w-[12px] h-[12px]" />
                  <span className="text-light-text dark:text-dark-text">{tag.label}</span>
                </button>
              ))
            ) : searchText ? (
              <button
                onClick={() => {
                  const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
                  const newTag = {
                    id: searchText.toLowerCase().replace(/\s+/g, '-'),
                    label: searchText,
                    color: randomColor
                  };
                  onCreateTag(newTag);
                  onSelectTag(newTag);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs rounded-[5px] hover:bg-black/5 dark:hover:bg-white/5"
              >
                <Plus className="w-[12px] h-[12px]" />
                <span className="text-light-text dark:text-dark-text">Create "{searchText}"</span>
              </button>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
