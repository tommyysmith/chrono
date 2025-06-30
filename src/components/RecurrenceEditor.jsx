'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RRule, RRuleSet, rrulestr, Weekday } from 'rrule';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox'; // Assuming Checkbox exists from shadcn/ui
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar'; // Shadcn's Calendar
import { Calendar as CalendarIcon } from '../assets/icons/Calendar';

// Helper to safely parse number input
const safeParseInt = (value, defaultValue = 1) => {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) || parsed < 1 ? defaultValue : parsed;
};

// Default options if none are provided
const defaultOptions = {
  freq: RRule.WEEKLY,
  interval: 1,
  // dtstart will be set when saving the task/event based on its initial date
};

const WEEKDAYS = [
  { label: 'Su', value: RRule.SU, weekday: 6 }, // RRule.SU.weekday is 6
  { label: 'Mo', value: RRule.MO, weekday: 0 }, // RRule.MO.weekday is 0
  { label: 'Tu', value: RRule.TU, weekday: 1 }, // RRule.TU.weekday is 1
  { label: 'We', value: RRule.WE, weekday: 2 }, // RRule.WE.weekday is 2
  { label: 'Th', value: RRule.TH, weekday: 3 }, // RRule.TH.weekday is 3
  { label: 'Fr', value: RRule.FR, weekday: 4 }, // RRule.FR.weekday is 4
  { label: 'Sa', value: RRule.SA, weekday: 5 }, // RRule.SA.weekday is 5
];

// Function to capitalize the first letter of a string
const capitalizeFirstLetter = (string) => {
  if (!string) return '';
  return string.charAt(0).toUpperCase() + string.slice(1);
};

// Helper to generate preview text parts
const generatePreviewParts = (options, startDate) => {
  if (!options || !options.freq) return [{ text: 'No recurrence set.', highlight: false }];

  const parts = [];
  const effectiveStartDate = startDate || new Date(); // Use provided start date or now

  // --- Frequency and Interval ---
  let freqText = '';
  switch (options.freq) {
    case RRule.DAILY: freqText = 'day'; break;
    case RRule.WEEKLY: freqText = 'week'; break;
    case RRule.MONTHLY: freqText = 'month'; break;
    case RRule.YEARLY: freqText = 'year'; break;
    default: freqText = '';
  }
  if (options.interval > 1) {
    parts.push({ text: `Every ${options.interval} ${freqText}s`, highlight: false });
  } else {
    parts.push({ text: `Every ${freqText}`, highlight: false });
  }

  // --- Specific Rules (Weekly, Monthly, Yearly) ---
  if (options.freq === RRule.WEEKLY && options.byweekday && options.byweekday.length > 0) {
    const sortedDays = options.byweekday.map(day => day.weekday).sort(); // RRule weekdays are 0=MO, 6=SU
    const dayNames = sortedDays.map(dayIndex => {
      // Adjust RRule index (0=MO) to standard JS index (0=SU) temporarily for formatting
      const jsDayIndex = (dayIndex + 1) % 7;
      return format(new Date(2023, 0, jsDayIndex + 1), 'EEEE'); // Get full weekday name
    });
    parts.push({ text: ' on ', highlight: false });
    parts.push({ text: dayNames.join(', '), highlight: true });
  } else if (options.freq === RRule.MONTHLY) {
    if (options.bymonthday) {
       parts.push({ text: ` on day ${options.bymonthday}`, highlight: true });
    } else if (options.bysetpos && options.byweekday && options.byweekday.length > 0) {
       const pos = options.bysetpos;
       const dayIndex = options.byweekday[0].weekday; // Assuming single weekday for monthly bysetpos
       const jsDayIndex = (dayIndex + 1) % 7;
       const dayName = format(new Date(2023, 0, jsDayIndex + 1), 'EEEE');
       let ordinal = '';
       if (pos === 1) ordinal = 'first';
       else if (pos === 2) ordinal = 'second';
       else if (pos === 3) ordinal = 'third';
       else if (pos === 4) ordinal = 'fourth';
       else if (pos === -1) ordinal = 'last';
       else ordinal = `${pos}th`; // Fallback, might need better ordinal handling
       parts.push({ text: ` on the ${ordinal} ${dayName}`, highlight: true });
    }
  }
  // Add Yearly logic if needed later

   // Ensure parts array is not empty before accessing index 0
   if (parts.length > 0) {
     parts[0].text = capitalizeFirstLetter(parts[0].text); // Capitalize the first part
   }

  // --- End Condition ---
  if (options.until) {
    const untilDate = options.until instanceof Date ? options.until : parseISO(options.until);
    parts.push({ text: `, until ${format(untilDate, 'PPP')}`, highlight: false });
  } else if (options.count) {
    parts.push({ text: `, ${options.count} times`, highlight: false });
  }

  return parts;
};

export default function RecurrenceEditor({ value, onChange, startDate }) {
  const [options, setOptions] = useState(() => value || defaultOptions);
  const [previewParts, setPreviewParts] = useState([]); // Add state for parts
  const [endType, setEndType] = useState(() => {
    if (options.until) return 'until';
    if (options.count) return 'count';
    return 'never';
  });
  const [monthlyMode, setMonthlyMode] = useState(() => {
     if (options.bymonthday) return 'dayOfMonth';
     if (options.bysetpos) return 'dayOfWeek';
     return 'dayOfMonth'; // Default if neither is set
  });
  // Store numeric weekdays (0=MO, 6=SU) for easier comparison in ToggleGroup
  const [selectedWeekdays, setSelectedWeekdays] = useState(() => {
    if (options.freq === RRule.WEEKLY && Array.isArray(options.byweekday)) {
      // Map Weekday objects to their numeric values
      return options.byweekday.map(wd => wd.weekday).sort((a, b) => a - b);
    }
    return [];
  });

  // Update internal state if the external value prop changes
  useEffect(() => {
    setOptions(value || defaultOptions);
    setEndType(() => {
      if (value?.until) return 'until';
      if (value?.count) return 'count';
      return 'never';
    });
     setMonthlyMode(() => {
      if (value?.bymonthday) return 'dayOfMonth';
      if (value?.bysetpos) return 'dayOfWeek';
      return 'dayOfMonth'; // Default if neither is set
    });
    setSelectedWeekdays(() => {
      if (value?.freq === RRule.WEEKLY && Array.isArray(value.byweekday)) {
        // Map Weekday objects to their numeric values
        return value.byweekday.map(wd => wd.weekday).sort((a, b) => a - b);
      }
      return [];
    });
  }, [value]);

  // Recalculate preview text when options or startDate change
  useEffect(() => {
    try {
      setPreviewParts(generatePreviewParts(options, startDate));
    } catch (error) {
      console.error("Error generating recurrence preview:", error);
      setPreviewParts([{ text: 'Invalid rule', highlight: false }]);
    }
  }, [options, startDate]);

  // Memoize the dtstart to prevent infinite loops
  const memoizedDtstart = useMemo(() => {
    return startDate || new Date();
  }, [startDate]);

  // Notify parent when options change (separate effect to avoid infinite loops)
  useEffect(() => {
    if (!onChange) return;
    
    // CRITICAL FIX: Use the exact startDate provided, don't create new Date objects
    // This preserves the original event's exact time and avoids timezone conversion issues
    let effectiveDtstart;
    if (startDate) {
      // Always use the startDate exactly as provided
      effectiveDtstart = startDate instanceof Date ? startDate : new Date(startDate);
    } else {
      effectiveDtstart = new Date();
    }
    
    console.log('🐛 [RECURRENCE-EDITOR] Setting dtstart:', {
      originalStartDate: startDate,
      effectiveDtstart: effectiveDtstart,
      effectiveDtstartISO: effectiveDtstart.toISOString(),
      type: typeof startDate
    });
    
    const optionsWithDtstart = {
      ...options,
      dtstart: effectiveDtstart
    };
    
    onChange(optionsWithDtstart);
  }, [options, startDate, onChange]);

  const handleOptionChange = (key, newValue) => {
    setOptions(prev => {
      const newOpts = { ...prev, [key]: newValue };
      
      // If changing frequency to weekly, ensure we have at least one weekday selected
      if (key === 'freq' && newValue === RRule.WEEKLY) {
        // If no weekdays are currently selected, default to the day of the week from startDate
        if (!newOpts.byweekday || newOpts.byweekday.length === 0) {
          // Use the actual startDate provided from the event, ensuring timezone consistency
          const effectiveStartDate = startDate || new Date();
          
          // Create a timezone-aware date to avoid UTC conversion issues
          let startDayOfWeek;
          if (typeof effectiveStartDate === 'string') {
            // If startDate is a string, parse it in local timezone
            const date = new Date(effectiveStartDate);
            startDayOfWeek = date.getDay();
          } else {
            // If it's already a Date object, use it directly
            startDayOfWeek = effectiveStartDate.getDay();
          }
          
          // Convert to RRule weekday format (0=Mon, 6=Sun)
          const rruleWeekday = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
          newOpts.byweekday = [new Weekday(rruleWeekday)];
          
          // Also update selectedWeekdays state
          setSelectedWeekdays([rruleWeekday]);
        }
      }
      
      return newOpts;
    });
  };

  const handleEndTypeChange = (newEndType) => {
    setEndType(newEndType);
    setOptions(prev => {
      const newOpts = { ...prev };
      if (newEndType === 'never') {
        delete newOpts.until;
        delete newOpts.count;
      } else if (newEndType === 'until') {
        delete newOpts.count;
        // Set a default 'until' if needed, or let DatePicker handle it
        if (!newOpts.until) {
           // Add default until date e.g., one year from start
           const defaultUntil = new Date(startDate || Date.now());
           defaultUntil.setFullYear(defaultUntil.getFullYear() + 1);
           newOpts.until = defaultUntil;
        }
      } else if (newEndType === 'count') {
        delete newOpts.until;
        if (!newOpts.count) newOpts.count = 10; // Default count
      }
      return newOpts;
    });
  };

  const handleMonthlyModeChange = (newMode) => {
    setMonthlyMode(newMode);
     setOptions(prev => {
      const newOpts = { ...prev };
      if (newMode === 'dayOfMonth') {
        delete newOpts.bysetpos;
        delete newOpts.byweekday; // Clear weekday settings for monthly
        if (!newOpts.bymonthday) {
          // Use timezone-aware date calculation
          const effectiveStartDate = startDate || new Date();
          let dayOfMonth;
          if (typeof effectiveStartDate === 'string') {
            // Parse string date in local timezone
            const date = new Date(effectiveStartDate);
            dayOfMonth = date.getDate();
          } else {
            dayOfMonth = effectiveStartDate.getDate();
          }
          newOpts.bymonthday = dayOfMonth;
        }
      } else { // dayOfWeek mode
        delete newOpts.bymonthday;
        if (!newOpts.bysetpos || !newOpts.byweekday) {
          // Calculate default: e.g., second Tuesday - using timezone-aware calculation
          const effectiveStartDate = startDate || new Date();
          let dayOfMonth, startDayOfWeek;
          
          if (typeof effectiveStartDate === 'string') {
            const date = new Date(effectiveStartDate);
            dayOfMonth = date.getDate();
            startDayOfWeek = date.getDay(); // 0=Sun, 1=Mon...
          } else {
            dayOfMonth = effectiveStartDate.getDate();
            startDayOfWeek = effectiveStartDate.getDay();
          }
          
          const weekOfMonth = Math.ceil(dayOfMonth / 7); // Approximation
          newOpts.bysetpos = weekOfMonth > 4 ? -1 : weekOfMonth; // Use -1 for last
          // Convert raw day index to Weekday instance
          newOpts.byweekday = [new Weekday(startDayOfWeek === 0 ? 6 : startDayOfWeek - 1)]; // Convert Sunday(0) to 6, others to n-1
        }
      }
      return newOpts;
    });
  };

  const handleWeekdayToggle = (weekdayValue) => {
    setSelectedWeekdays(prev => {
      const isSelected = prev.includes(weekdayValue);
      let newSelection;
      if (isSelected) {
        // Prevent deselecting the last day
        if (prev.length <= 1) return prev;
        newSelection = prev.filter(day => day !== weekdayValue);
      } else {
        newSelection = [...prev, weekdayValue].sort((a, b) => a - b); // Keep sorted
      }

      // Update the main options state directly
      handleOptionChange('byweekday', newSelection.length > 0 ? newSelection.map(num => new Weekday(num)) : undefined);
      return newSelection;
    });
  };

  const freqLabel = (freq) => {
    switch(freq) {
      case RRule.DAILY: return 'days';
      case RRule.WEEKLY: return 'weeks';
      case RRule.MONTHLY: return 'months';
      case RRule.YEARLY: return 'years';
      default: return '';
    }
  };

  return (
    <div className="space-y-4">

      {/* --- Frequency and Interval --- */}
        <div className="flex px-8 flex-col gap-2">
          <Label className="mb-2" htmlFor="recurrence-interval">Repeat every</Label>
      <div className="flex items-center space-x-2">

          <Input
            id="recurrence-interval"
            type="number"
            min="1"
          value={options.interval || 1}
          onChange={(e) => handleOptionChange('interval', safeParseInt(e.target.value))}
          className="w-[56px]"
          />
        <Select
          value={options.freq ?? RRule.WEEKLY} // Default to Weekly if undefined
          onValueChange={(value) => handleOptionChange('freq', parseInt(value, 10))}
        >
          <SelectTrigger className="w-auto gap-2">
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          {/* Use a much higher z-index and ensure SelectItem values are numbers */}
          <SelectContent>
            <SelectItem className="hover:bg-white/15 dark:hover:bg-white-5 text-xs" value={RRule.DAILY}>Days</SelectItem>
            <SelectItem className="hover:bg-white/15 dark:hover:bg-white-5 text-xs" value={RRule.WEEKLY}>Weeks</SelectItem>
            <SelectItem className="hover:bg-white/15 dark:hover:bg-white-5 text-xs" value={RRule.MONTHLY}>Months</SelectItem>
            <SelectItem className="hover:bg-white/15 dark:hover:bg-white-5 text-xs" value={RRule.YEARLY}>Years</SelectItem>
          </SelectContent>
        </Select>
      </div>
        
      </div>

      {/* --- Frequency Specific Options --- */}
      {options.freq === RRule.WEEKLY && (
        <div className="flex flex-col px-8 gap-2">
          <Label className="text-xs font-medium mb-2 block">Repeat on</Label>
          <div className="flex justify-start gap-2">
            {WEEKDAYS.map(day => (
              <Button
                key={day.label}
                variant="outline"
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-[5px] text-xs bg-light-bg dark:bg-white/5 shadow-sm text-light-text dark:text-dark-text border border-light-border dark:border-dark-border", // Make them circular and smaller
                  selectedWeekdays.includes(day.weekday) && "bg-primary dark:bg-primary text-dark-text border-none dark:text-dark-text hover:dark:bg-primary/90 hover:bg-primary/90"
                )}
                onClick={() => {
                  // Toggle the weekday in the selectedWeekdays array
                  const newSelectedWeekdays = selectedWeekdays.includes(day.weekday)
                    ? selectedWeekdays.filter(wd => wd !== day.weekday)
                    : [...selectedWeekdays, day.weekday].sort((a, b) => a - b);
                  
                  setSelectedWeekdays(newSelectedWeekdays);
                  
                  // Convert numbers back to RRule.Weekday objects for the options state
                  const rruleWeekdays = newSelectedWeekdays.map(num => new Weekday(num));
                  handleOptionChange('byweekday', rruleWeekdays.length > 0 ? rruleWeekdays : undefined);
                }}
                aria-pressed={selectedWeekdays.includes(day.weekday)}
              >
                {day.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="w-full h-[1px] bg-light-border dark:bg-dark-border"></div>

      {/* --- Monthly Options --- */}
      {options.freq === RRule.MONTHLY && (
        <div className="space-y-4 px-8">
          <RadioGroup value={monthlyMode} onValueChange={handleMonthlyModeChange} className="space-y-2">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dayOfMonth" id="monthly-day" />
              <Label htmlFor="monthly-day" className="flex items-center gap-2">
                On day
                <Input
                  type="number"
                  min="1" max="31"
                  value={options.bymonthday || (startDate || new Date()).getDate()}
                  onChange={(e) => handleOptionChange('bymonthday', safeParseInt(e.target.value))}
                  disabled={monthlyMode !== 'dayOfMonth'}
                  className="w-16 h-8"
                />
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="dayOfWeek" id="monthly-weekday" />
              <Label htmlFor="monthly-weekday" className="flex items-center gap-2">
                On the {/* Placeholder for Ordinal + Weekday Selector */}
                 {/* TODO: Implement Ordinal (first, second..) & Weekday selector */}
                 <span>(Ordinal/Weekday selection coming soon)</span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* --- End Condition --- */}
      <div className="space-y-2 px-8">
        <Label>Ends</Label>
        <RadioGroup value={endType} onValueChange={handleEndTypeChange} className="space-y-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="never" id="end-never" />
            <Label htmlFor="end-never">Never</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="until" id="end-until" />
            <Label htmlFor="end-until" className="flex items-center gap-2">
              On
               <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "justify-start text-left font-normal gap-0 border border-light-border dark:border-dark-border h-[36px] px-2",
                      !options.until && "text-light-text/50 dark:text-dark-text/50",
                      options.until && "text-light-text dark:text-dark-text bg-light-bg dark:bg-white/5"
                    )}
                    disabled={endType !== 'until'}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {options.until ? format(options.until instanceof Date ? options.until : parseISO(options.until), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] border border-light-border dark:border-dark-border" align="start">
                  <Calendar
                    mode="single"
                    selected={options.until instanceof Date ? options.until : (options.until ? parseISO(options.until) : undefined)}
                    onSelect={(date) => handleOptionChange('until', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="count" id="end-count" />
            <Label htmlFor="end-count" className="flex items-center gap-2">
              After
              <Input
                type="number"
                min="1"
                value={options.count || 10}
                onChange={(e) => handleOptionChange('count', safeParseInt(e.target.value))}
                disabled={endType !== 'count'}
                className="w-16 h-8"
              />
               occurrences
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="w-full h-[1px] bg-light-border dark:bg-dark-border"></div>


      {/* --- Preview --- */}
      <Label className="text-xs px-8 font-medium mb-2 block">Preview</Label>
      <p className="text-xs font-medium text-light-text/50 dark:text-dark-text/50 px-8">
        {previewParts.map((part, index) => (
          <span key={index} className={cn(part.highlight && "font-semibold text-light-text dark:text-dark-text" /* Adjust styling as needed */)}>
            {part.text}
          </span>
        ))}
      </p>

    </div>
  );
}

// Helper function to get RRule Weekday constant (e.g., RRule.MO)
const getRRuleWeekday = (dayIndex) => {
  // Assumes dayIndex: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Maps directly to RRule constants like SU, MO, TU, etc.
  const weekdays = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
  return weekdays[dayIndex];
};

// Helper function to get day index (0-6) from RRule Weekday constant
const getDayIndexFromRRule = (rruleWeekday) => {
   // RRule Weekday objects have a 'weekday' property (0=Mon...6=Sun)
   // Our WEEKDAYS array uses RRule constants directly.
   // The ToggleGroup and logic should handle RRule constants correctly.
   return rruleWeekday.weekday;
};
