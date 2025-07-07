import { useState, useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash } from "@/assets/icons/Trash";
import { EyeHidden } from "@/assets/icons/EyeHidden";
import { Lightning } from "@/assets/icons/Lightning";
import { Tag } from "@/assets/icons/Tag";
import { Calendar as CalendarIcon } from "@/assets/icons/Calendar";
import { Check } from "@/assets/icons/Check";
import { None } from "@/assets/icons/None";
import { Low } from "@/assets/icons/Low";
import { Medium } from "@/assets/icons/Medium";
import { High } from "@/assets/icons/High";

import { Chevron as ChevronRight } from '@/assets/icons/Chevron';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Priority options from CommandBar
const PRIORITY_OPTIONS = [
  { id: 'High', label: 'High', color: '#EF4444' },
  { id: 'Medium', label: 'Medium', color: '#F59E0B' },
  { id: 'Low', label: 'Low', color: '#10B981' },
  { id: 'None', label: 'None', color: '#6B7280' }
];

// Helper function to get the appropriate priority icon
const getPriorityIcon = (priority) => {
  switch (priority) {
    case 'High':
      return High;
    case 'Medium':
      return Medium;
    case 'Low':
      return Low;
    case 'None':
    default:
      return None;
  }
};

const EnhancedTaskContextMenu = ({
  isOpen,
  onOpenChange,
  task,
  position, // Mouse cursor position for right-click context menus
  onEdit,
  onDelete,
  onRemoveFromCalendar,
  onMarkAsDone,
  onPriorityChange,
  onTagChange,
  onScheduleChange,
  children, // This will be the trigger element
}) => {
  const [tags, setTags] = useState([]);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [scheduleMenuOpen, setScheduleMenuOpen] = useState(false);
  const [customDateMenuOpen, setCustomDateMenuOpen] = useState(false);
  
  // Refs for hover timing
  const priorityTimeoutRef = useRef(null);
  const tagTimeoutRef = useRef(null);
  const scheduleTimeoutRef = useRef(null);
  const customDateTimeoutRef = useRef(null);

  // Load tags from localStorage
  useEffect(() => {
    const savedTags = localStorage.getItem('tags');
    if (savedTags) {
      try {
        const parsedTags = JSON.parse(savedTags);
        // Handle both object and array formats
        if (Array.isArray(parsedTags)) {
          setTags(parsedTags);
        } else if (typeof parsedTags === 'object') {
          // Convert object to array if it's stored as an object
          setTags(Object.values(parsedTags));
        }
      } catch (e) {
        console.error('Error parsing tags:', e);
        setTags([]);
      }
    } else {
      // Default tags if none exist
      setTags([
        { id: 'work', label: 'Work', color: '#EF4444' },
        { id: 'family', label: 'Family', color: '#3B82F6' },
        { id: 'personal', label: 'Personal', color: '#A855F7' },
        { id: 'travel', label: 'Travel', color: '#22C55E' }
      ]);
    }
  }, []);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (priorityTimeoutRef.current) clearTimeout(priorityTimeoutRef.current);
      if (tagTimeoutRef.current) clearTimeout(tagTimeoutRef.current);
      if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
      if (customDateTimeoutRef.current) clearTimeout(customDateTimeoutRef.current);
    };
  }, []);

  // Check if task is on calendar (has scheduledDate or addToCalendar flag)
  const isOnCalendar = task?.scheduledDate || task?.addToCalendar;

  // Schedule options
  const getScheduleOptions = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return [
      { id: 'today', label: 'Today', date: today },
      { id: 'tomorrow', label: 'Tomorrow', date: tomorrow },
      { id: 'custom', label: 'Pick date...', date: null },
    ];
  };

  // Hover handlers for Priority
  const handlePriorityMouseEnter = () => {
    if (priorityTimeoutRef.current) clearTimeout(priorityTimeoutRef.current);
    setPriorityMenuOpen(true);
    setTagMenuOpen(false);
    setScheduleMenuOpen(false);
  };

  const handlePriorityMouseLeave = () => {
    priorityTimeoutRef.current = setTimeout(() => {
      setPriorityMenuOpen(false);
    }, 100);
  };

  // Hover handlers for Tag
  const handleTagMouseEnter = () => {
    if (tagTimeoutRef.current) clearTimeout(tagTimeoutRef.current);
    setTagMenuOpen(true);
    setPriorityMenuOpen(false);
    setScheduleMenuOpen(false);
  };

  const handleTagMouseLeave = () => {
    tagTimeoutRef.current = setTimeout(() => {
      setTagMenuOpen(false);
    }, 100);
  };

  // Hover handlers for Schedule
  const handleScheduleMouseEnter = () => {
    if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
    setScheduleMenuOpen(true);
    setPriorityMenuOpen(false);
    setTagMenuOpen(false);
  };

  const handleScheduleMouseLeave = () => {
    scheduleTimeoutRef.current = setTimeout(() => {
      setScheduleMenuOpen(false);
    }, 100);
  };

  // Hover handlers for Custom Date
  const handleCustomDateMouseEnter = () => {
    if (customDateTimeoutRef.current) clearTimeout(customDateTimeoutRef.current);
    setCustomDateMenuOpen(true);
  };

  const handleCustomDateMouseLeave = () => {
    customDateTimeoutRef.current = setTimeout(() => {
      setCustomDateMenuOpen(false);
    }, 100);
  };

  // Selection handlers
  const handlePrioritySelect = (priority) => {
    onPriorityChange?.(task, priority);
    setPriorityMenuOpen(false);
    onOpenChange?.(false);
  };

  const handleTagSelect = (tag) => {
    onTagChange?.(task, tag);
    setTagMenuOpen(false);
    onOpenChange?.(false);
  };

  const handleScheduleSelect = (option) => {
    if (option.id === 'custom') {
      // For now, just call with a placeholder - could open a date picker in the future
      onScheduleChange?.(task, 'custom');
    } else {
      onScheduleChange?.(task, option.date);
    }
    setScheduleMenuOpen(false);
    onOpenChange?.(false);
  };

  const handleCustomDateSelect = (date) => {
    onScheduleChange?.(task, date);
    setCustomDateMenuOpen(false);
    setScheduleMenuOpen(false);
    onOpenChange?.(false);
  };

  // Adjust position to keep menu within viewport
  const getAdjustedPosition = (pos) => {
    if (!pos) return undefined;
    
    const menuWidth = 180;
    const menuHeight = 300; // Approximate height
    const padding = 10;
    
    let { x, y } = pos;
    
    // Adjust horizontal position if menu would go off-screen
    try {
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - padding;
      }
      if (x < padding) {
        x = padding;
      }

      // Adjust vertical position if menu would go off-screen
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - padding;
      }
      if (y < padding) {
        y = padding;
      }
    } catch (e) {
      // Window not available (SSR), use original position
    }
    
    return { x, y };
  };

  const adjustedPosition = getAdjustedPosition(position);

  // Handle clicks outside the menu when positioned absolutely
  useEffect(() => {
    if (!isOpen || !position) return;

    const handleClickOutside = (e) => {
      // Check if click is outside the context menu
      const contextMenu = e.target.closest('[data-context-menu]');
      if (!contextMenu) {
        onOpenChange?.(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, position, onOpenChange]);

  if (!task) return null;

  // If position is provided, render as a fixed positioned element
  if (position) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close menu when clicking outside */}
            <div 
              className="fixed inset-0 z-[9998]" 
              onClick={() => onOpenChange?.(false)}
            />
            {/* Context Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-0 focus:outline-none focus-visible:outline-none"
              style={{
                position: 'fixed',
                left: `${adjustedPosition.x}px`,
                top: `${adjustedPosition.y}px`,
                zIndex: 9999
              }}
              data-context-menu
            >
        {/* Quick Actions Section */}
        <div className="pt-1 px-1">
          <button 
            onClick={() => {
              onMarkAsDone?.(task);
              onOpenChange?.(false);
            }}
            className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all"
          >
            <Check className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
            Mark as done
          </button>
        </div>

        <div className="my-1 h-px bg-dark-border dark:bg-dark-border" />

        {/* Submenu Actions Section */}
        <div className="py-1 space-y-0.5 px-1">
          {/* Priority Submenu */}
          <Popover open={priorityMenuOpen} onOpenChange={setPriorityMenuOpen}>
            <PopoverTrigger asChild>
              <button 
                className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all justify-between" 
                onMouseEnter={handlePriorityMouseEnter}
                onMouseLeave={handlePriorityMouseLeave}
                onClick={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-2">
                  <Lightning className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Priority
                </div>
                <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-1 space-y-0.5"
              onMouseEnter={() => {
                if (priorityTimeoutRef.current) clearTimeout(priorityTimeoutRef.current);
              }}
              onMouseLeave={handlePriorityMouseLeave}
              data-context-menu
            >
              {PRIORITY_OPTIONS.map((priority) => {
                const IconComponent = getPriorityIcon(priority.id);
                const isSelected = task.priority === priority.id;
                return (
                  <button
                    key={priority.id}
                    onClick={() => handlePrioritySelect(priority.id)}
                    className={`w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all `}
                  >
                    <IconComponent 
                      className={`w-3 h-3 ${priority.id === 'None' ? 'text-dark-text/50 dark:text-dark-text/50' : ''}`} 
                      style={priority.id === 'None' ? {} : { color: priority.color }} 
                    />
                    {priority.label}
                    {isSelected && <Check className="ml-auto w-3 h-3" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Tag Submenu */}
          <Popover open={tagMenuOpen} onOpenChange={setTagMenuOpen}>
            <PopoverTrigger asChild>
              <button 
                className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all justify-between" 
                onMouseEnter={handleTagMouseEnter}
                onMouseLeave={handleTagMouseLeave}
                onClick={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Tag
                </div>
                <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-1 space-y-0.5"
              onMouseEnter={() => {
                if (tagTimeoutRef.current) clearTimeout(tagTimeoutRef.current);
              }}
              onMouseLeave={handleTagMouseLeave}
              data-context-menu
            >
              {/* No tag option */}
              <button
                onClick={() => handleTagSelect(null)}
                className={`w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all`}
              >
                <div className="w-3 h-3 rounded-[5px] border border-dashed border-white/50" />
                No tag
                {!task.tag && <Check className="ml-auto w-3 h-3" />}
              </button>
              {tags.map((tag) => {
                const isSelected = task.tag?.id === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagSelect(tag)}
                    className={`w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all`}
                  >
                    <div 
                      className="w-3 h-3 rounded-[5px] border border-black/20" 
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.label}
                    {isSelected && <Check className="ml-auto w-3 h-3" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Schedule Submenu */}
          <Popover open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen}>
            <PopoverTrigger asChild>
              <button 
                className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all justify-between" 
                onMouseEnter={handleScheduleMouseEnter}
                onMouseLeave={handleScheduleMouseLeave}
                onClick={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Schedule
                </div>
                <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
              </button>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start"
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-1 space-y-0.5"
              onMouseEnter={() => {
                if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
              }}
              onMouseLeave={handleScheduleMouseLeave}
              data-context-menu
            >
              {getScheduleOptions().map((option) => {
                if (option.id === 'custom') {
                  return (
                    <Popover key={option.id} open={customDateMenuOpen} onOpenChange={setCustomDateMenuOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all justify-between"
                          onMouseEnter={handleCustomDateMouseEnter}
                          onMouseLeave={handleCustomDateMouseLeave}
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
                            {option.label}
                          </div>
                          <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="right" 
                        align="start"
                        className="bg-dark-bg-lighter dark:bg-dark-bg shadow-2xl rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 p-3"
                        onMouseEnter={() => {
                          if (customDateTimeoutRef.current) clearTimeout(customDateTimeoutRef.current);
                        }}
                        onMouseLeave={handleCustomDateMouseLeave}
                        data-context-menu
                      >
                        <Calendar
                          mode="single"
                          selected={task.scheduledDate ? new Date(task.scheduledDate) : undefined}
                          onSelect={handleCustomDateSelect}
                          className="w-full"
                        />
                      </PopoverContent>
                    </Popover>
                  );
                }
                return (
                  <button
                    key={option.id}
                    onClick={() => handleScheduleSelect(option)}
                    className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all"
                  >
                    <CalendarIcon className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
                    {option.label}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        <div className="my-1 h-px bg-dark-border dark:bg-dark-border" />

        {/* Management Actions Section */}
        <div className="py-1 last:pb-0 last:pt-1 space-y-0.5 px-1">
          {/* Edit */}
          <button onClick={() => {
            onEdit?.(task);
            onOpenChange?.(false);
          }}
          className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all"
          >
            <Pencil className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
            Edit
          </button>

          {/* Remove from calendar (only if on calendar and not a recurring task) */}
          {isOnCalendar && !(task.isRepeat === true || task.seriesId || (task.repeat && task.repeat !== 'none')) && (
            <button onClick={() => {
              onRemoveFromCalendar?.(task);
              onOpenChange?.(false);
            }}
            className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all"
            >
              <EyeHidden className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
              Remove from calendar
            </button>
          )}
        </div>
        
        <div className="my-1 h-px bg-dark-border dark:bg-dark-border" />
        
        <div className="pt-0 pb-1 px-1">
          <button 
            onClick={() => {
              onDelete?.(task);
              onOpenChange?.(false);
            }}
            className="w-full group text-left text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white focus:bg-[#EC0F0F] dark:focus:bg-[#BE2020] focus:text-white px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs transition-all"
          >
            <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white group-hover:dark:text-white" />
            <span className="text-[#EC0F0F] group-hover:text-white group-hover:dark:text-white">Delete</span>
          </button>
                 </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
     );
  }

  // Fallback to regular Popover for non-positioned usage (TaskItem hover)
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        align="start" 
        className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-0 focus:outline-none focus-visible:outline-none"
        data-context-menu
      >
        {/* Quick Actions Section */}
        <div className="pt-1 pb-1 px-1">
          <DropdownMenuItem 
            onClick={() => {
              onMarkAsDone?.(task);
              onOpenChange?.(false);
            }}
            className="text-dark-text dark:text-dark-text"
          >
            <Check className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
            Mark as done
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        {/* Submenu Actions Section */}
        <div className="py-1 space-y-0.5 px-1">
          {/* Priority Submenu */}
          <Popover open={priorityMenuOpen} onOpenChange={setPriorityMenuOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem 
                className="justify-between" 
                onMouseEnter={handlePriorityMouseEnter}
                onMouseLeave={handlePriorityMouseLeave}
                onClick={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-2">
                  <Lightning className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Priority
                </div>
                <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-2xl rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-1 space-y-0.5"
              onMouseEnter={() => {
                if (priorityTimeoutRef.current) clearTimeout(priorityTimeoutRef.current);
              }}
              onMouseLeave={handlePriorityMouseLeave}
              data-context-menu
            >
              {PRIORITY_OPTIONS.map((priority) => {
                const IconComponent = getPriorityIcon(priority.id);
                const isSelected = task.priority === priority.id;
                return (
                  <button
                    key={priority.id}
                    onClick={() => handlePrioritySelect(priority.id)}
                    className={`w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all `}
                  >
                    <IconComponent 
                      className={`w-3 h-3 ${priority.id === 'None' ? 'text-dark-text/50 dark:text-dark-text/50' : ''}`} 
                      style={priority.id === 'None' ? {} : { color: priority.color }} 
                    />
                    {priority.label}
                    {isSelected && <Check className="ml-auto w-3 h-3" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Tag Submenu */}
          <Popover open={tagMenuOpen} onOpenChange={setTagMenuOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem 
                className="justify-between" 
                onMouseEnter={handleTagMouseEnter}
                onMouseLeave={handleTagMouseLeave}
                onClick={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Tag
                </div>
                <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-2xl rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-1 space-y-0.5"
              onMouseEnter={() => {
                if (tagTimeoutRef.current) clearTimeout(tagTimeoutRef.current);
              }}
              onMouseLeave={handleTagMouseLeave}
              data-context-menu
            >
              {/* No tag option */}
              <button
                onClick={() => handleTagSelect(null)}
                className={`w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all`}
              >
                <div className="w-3 h-3 rounded-full border border-light-border dark:border-dark-border" />
                No tag
                {!task.tag && <Check className="ml-auto w-3 h-3" />}
              </button>
              {tags.map((tag) => {
                const isSelected = task.tag?.id === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleTagSelect(tag)}
                    className={`w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all`}
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.label}
                    {isSelected && <Check className="ml-auto w-3 h-3" />}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          {/* Schedule Submenu */}
          <Popover open={scheduleMenuOpen} onOpenChange={setScheduleMenuOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem 
                className="justify-between" 
                onMouseEnter={handleScheduleMouseEnter}
                onMouseLeave={handleScheduleMouseLeave}
                onClick={(e) => e.preventDefault()}
              >
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Schedule
                </div>
                <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent 
              side="right" 
              align="start" 
              className="bg-dark-bg-lighter dark:bg-dark-bg shadow-2xl rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-1 space-y-0.5"
              onMouseEnter={() => {
                if (scheduleTimeoutRef.current) clearTimeout(scheduleTimeoutRef.current);
              }}
              onMouseLeave={handleScheduleMouseLeave}
              data-context-menu
            >
              {getScheduleOptions().map((option) => {
                if (option.id === 'custom') {
                  return (
                    <Popover key={option.id} open={customDateMenuOpen} onOpenChange={setCustomDateMenuOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all justify-between"
                          onMouseEnter={handleCustomDateMouseEnter}
                          onMouseLeave={handleCustomDateMouseLeave}
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
                            {option.label}
                          </div>
                          <ChevronRight className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent 
                        side="right" 
                        align="start"
                        className="bg-dark-bg-lighter dark:bg-dark-bg shadow-2xl rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 p-3"
                        onMouseEnter={() => {
                          if (customDateTimeoutRef.current) clearTimeout(customDateTimeoutRef.current);
                        }}
                        onMouseLeave={handleCustomDateMouseLeave}
                        data-context-menu
                      >
                        <Calendar
                          mode="single"
                          selected={task.scheduledDate ? new Date(task.scheduledDate) : undefined}
                          onSelect={handleCustomDateSelect}
                          className="w-full"
                        />
                      </PopoverContent>
                    </Popover>
                  );
                }
                return (
                  <button
                    key={option.id}
                    onClick={() => handleScheduleSelect(option)}
                    className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all"
                  >
                    <CalendarIcon className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50" />
                    {option.label}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>

        <DropdownMenuSeparator />

        {/* Management Actions Section */}
        <div className="py-1 last:pb-0 last:pt-1 space-y-0.5 px-1">
          {/* Edit */}
          <DropdownMenuItem onClick={() => {
            onEdit?.(task);
            onOpenChange?.(false);
          }}>
            <Pencil className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
            Edit
          </DropdownMenuItem>

          {/* Remove from calendar (only if on calendar and not a recurring task) */}
          {isOnCalendar && !(task.isRepeat === true || task.seriesId || (task.repeat && task.repeat !== 'none')) && (
            <DropdownMenuItem onClick={() => {
              onRemoveFromCalendar?.(task);
              onOpenChange?.(false);
            }}>
              <EyeHidden className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
              Remove from calendar
            </DropdownMenuItem>
          )}

          {/* Delete */}
          
        </div>
        <DropdownMenuSeparator />
        <div className="pt-1 pb-1 px-1">
        <DropdownMenuItem 
            onClick={() => {
              onDelete?.(task);
              onOpenChange?.(false);
            }}
            className="text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white focus:bg-[#EC0F0F] dark:focus:bg-[#BE2020] focus:text-white"
          >
            <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white group-hover:dark:text-white" />
            <span className="text-[#EC0F0F] group-hover:text-white group-hover:dark:text-white">Delete</span>
          </DropdownMenuItem>
        </div>

      </PopoverContent>
    </Popover>
  );
};

export default EnhancedTaskContextMenu;
