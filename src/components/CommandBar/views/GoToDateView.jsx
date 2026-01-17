'use client';

import { useState, memo, useCallback } from 'react';
import { format } from 'date-fns';
import { useCommandBar, VIEW_MODES } from '../CommandBarContext';
import { ArrowAlt } from '../../../assets/icons/ArrowAlt';
import { parseNaturalLanguage } from '../../../utils/dateUtils';

function GoToDateView({ onDateSelect }) {
  const { setMode } = useCommandBar();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleBack = useCallback(() => {
    setMode(VIEW_MODES.DEFAULT);
    setQuery('');
    setSuggestions([]);
  }, [setMode]);

  const handleQueryChange = useCallback((e) => {
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
  }, []);

  const handleGoToDate = useCallback((date) => {
    if (date) {
      onDateSelect(date);
      setMode(VIEW_MODES.DEFAULT);
      setQuery('');
      setSuggestions([]);
    }
  }, [onDateSelect, setMode]);

  return (
    <div className="flex flex-col w-[450px]">
      <div className="flex items-start justify-between -mx-4">
        <div className="flex-1">
          <div className="flex flex-col divide-y divide-light-border dark:divide-dark-border">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 px-4 py-4 border-b border-light-border dark:border-dark-border">
                <div
                  className="cursor-pointer flex items-center mr-2"
                  onClick={handleBack}
                >
                  <button
                    type="button"
                    className="flex group items-center justify-center cursor-pointer hover:bg-light-bg-lighter dark:hover:bg-white/5 rounded-[5px] h-[32px] w-[32px]"
                  >
                    <ArrowAlt
                      className="w-5 h-5 group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text transition-colors"
                      style={{ transform: 'rotate(180deg)' }}
                    />
                  </button>
                </div>

                <div className="flex-1 flex-col gap-1 pl-1">
                  <input
                    type="text"
                    placeholder="e.g. nov 5, in 10 weeks"
                    value={query}
                    onChange={handleQueryChange}
                    className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none"
                    autoFocus
                  />
                </div>
              </div>
              
              {query && (
                <div className="p-2">
                  {suggestions.length > 0 ? (
                    suggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => handleGoToDate(suggestion.date)}
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
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(GoToDateView);
