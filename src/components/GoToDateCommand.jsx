'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parse, addWeeks, addMonths, addYears, parseISO, addDays, isValid, format } from 'date-fns';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'
];

const MONTH_ABBREVIATIONS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
];

const NUMBER_WORDS = {
  'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
  'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
  'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
  'eighty': 80, 'ninety': 90
};

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      onDateSelect(suggestions[0].date);
      onClose();
    }
  };

  const findMatchingMonth = (input) => {
    input = input.toLowerCase();
    // Try exact matches first
    const exactMonth = MONTHS.findIndex(month => month.startsWith(input));
    if (exactMonth !== -1) return exactMonth;
    
    const exactAbbrev = MONTH_ABBREVIATIONS.findIndex(month => month.startsWith(input));
    if (exactAbbrev !== -1) return exactAbbrev;

    return -1;
  };

  const parseNumberWord = (input) => {
    input = input.toLowerCase().trim();
    
    // Direct match
    if (NUMBER_WORDS.hasOwnProperty(input)) {
      return NUMBER_WORDS[input];
    }

    // Handle compound numbers (e.g., "twenty two")
    const parts = input.split(/\s+/);
    if (parts.length === 2) {
      const tens = NUMBER_WORDS[parts[0]];
      const ones = NUMBER_WORDS[parts[1]];
      if (tens && ones && tens % 10 === 0) {
        return tens + ones;
      }
    }

    // Handle hyphenated numbers (e.g., "twenty-two")
    const hyphenParts = input.split('-');
    if (hyphenParts.length === 2) {
      const tens = NUMBER_WORDS[hyphenParts[0]];
      const ones = NUMBER_WORDS[hyphenParts[1]];
      if (tens && ones && tens % 10 === 0) {
        return tens + ones;
      }
    }

    return null;
  };

  const parseNaturalLanguage = (input) => {
    input = input.toLowerCase().trim();
    const today = new Date();

    // Handle empty input
    if (!input) return null;

    // Handle specific date format (YYYY-MM-DD)
    if (input.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const date = parseISO(input);
      return isValid(date) ? date : null;
    }

    // Handle relative time expressions without "in"
    // e.g., "ten weeks", "2 months", "twenty-five days"
    const simpleTimeMatch = input.match(/^([a-zA-Z0-9-\s]+)\s*(day|days|week|weeks|month|months|year|years)$/);
    if (simpleTimeMatch) {
      const [_, amountStr, unit] = simpleTimeMatch;
      let amount;
      
      // Try parsing as a number first
      const numericAmount = parseInt(amountStr);
      if (!isNaN(numericAmount)) {
        amount = numericAmount;
      } else {
        // Try parsing as a word number
        amount = parseNumberWord(amountStr);
      }

      if (amount !== null) {
        switch(unit) {
          case 'day':
          case 'days':
            return addDays(today, amount);
          case 'week':
          case 'weeks':
            return addWeeks(today, amount);
          case 'month':
          case 'months':
            return addMonths(today, amount);
          case 'year':
          case 'years':
            return addYears(today, amount);
        }
      }
    }

    // Handle relative time expressions with "in"
    // e.g., "in ten weeks", "in 2 months"
    const relativeTimeMatch = input.match(/^in\s+([a-zA-Z0-9-\s]+)\s*(day|days|week|weeks|month|months|year|years)$/);
    if (relativeTimeMatch) {
      const [_, amountStr, unit] = relativeTimeMatch;
      let amount;
      
      // Try parsing as a number first
      const numericAmount = parseInt(amountStr);
      if (!isNaN(numericAmount)) {
        amount = numericAmount;
      } else {
        // Try parsing as a word number
        amount = parseNumberWord(amountStr);
      }

      if (amount !== null) {
        switch(unit) {
          case 'day':
          case 'days':
            return addDays(today, amount);
          case 'week':
          case 'weeks':
            return addWeeks(today, amount);
          case 'month':
          case 'months':
            return addMonths(today, amount);
          case 'year':
          case 'years':
            return addYears(today, amount);
        }
      }
    }

    // Handle month name input (partial or complete)
    const monthIndex = findMatchingMonth(input);
    if (monthIndex !== -1) {
      const date = new Date();
      date.setMonth(monthIndex);
      return date;
    }

    // Handle "month day" format (e.g., "nov 5")
    const monthDayMatch = input.match(/^([a-z]+)\s*(\d{1,2})?$/);
    if (monthDayMatch) {
      const [_, monthStr, dayStr] = monthDayMatch;
      const monthIndex = findMatchingMonth(monthStr);
      
      if (monthIndex !== -1) {
        const date = new Date();
        date.setMonth(monthIndex);
        if (dayStr) {
          const day = parseInt(dayStr);
          if (day >= 1 && day <= 31) {
            date.setDate(day);
          }
        }
        return date;
      }
    }

    // Handle "today", "tomorrow", etc.
    const commonTerms = {
      'today': () => today,
      'tomorrow': () => addDays(today, 1),
      'next week': () => addWeeks(today, 1),
      'next month': () => addMonths(today, 1),
      'next year': () => addYears(today, 1),
      'yesterday': () => addDays(today, -1),
      'last week': () => addWeeks(today, -1),
      'last month': () => addMonths(today, -1),
      'last year': () => addYears(today, -1)
    };

    if (commonTerms[input]) {
      return commonTerms[input]();
    }

    return null;
  };

  const handleQueryChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    const date = parseNaturalLanguage(newQuery);
    if (date) {
      setSuggestions([{
        date,
        label: format(date, 'MMMM d, yyyy')
      }]);
    } else {
      setSuggestions([]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-light-border dark:border-dark-border dark:bg-dark-bg rounded-[13px] shadow-lg w-full max-w-md"
      >
        <div className="flex flex-col">
          <form onSubmit={handleSubmit} className="p-4 border-b border-light-border dark:border-dark-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              placeholder="e.g. nov 5, in 10 weeks"
              className="w-full bg-transparent border-none outline-none text-lg text-light-text dark:text-dark-text"
              autoFocus
            />
          </form>
          {query && (
            <div className="p-2">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      onDateSelect(suggestion.date);
                      onClose();
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-light-text dark:text-dark-text hover:bg-black/5 dark:hover:bg-white/5 rounded-[9px] cursor-pointer"
                  >
                    Go to <span className="font-medium">{suggestion.label}</span>
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-light-text/50 dark:text-dark-text/50">
                  No matching date found
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
