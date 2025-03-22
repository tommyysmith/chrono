'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { parseNaturalLanguage } from '../utils/dateUtils';

export default function GoToDateCommand({ isOpen, onClose, onDateSelect }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSuggestions([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleQueryChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Parse the query and update suggestions
    const parsedDate = parseNaturalLanguage(newQuery);
    if (parsedDate) {
      setSuggestions([
        {
          date: parsedDate,
          label: format(parsedDate, 'EEEE, MMMM d, yyyy')
        }
      ]);
    } else {
      setSuggestions([]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      onDateSelect(suggestions[0].date);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 w-[600px] bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg shadow-lg p-4 z-50"
        >
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="Type a date or use natural language (e.g., 'next week', 'in 3 days')"
              className="w-full bg-light-bg-lighter dark:bg-dark-bg-lighter border border-light-border dark:border-dark-border rounded-md px-4 py-2 text-sm text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          </form>
          {suggestions.length > 0 && (
            <div className="mt-2 bg-light-bg-lighter dark:bg-dark-bg-lighter border border-light-border dark:border-dark-border rounded-md">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onDateSelect(suggestion.date);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-primary/10 first:rounded-t-md last:rounded-b-md"
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
