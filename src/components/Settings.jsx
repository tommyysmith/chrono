'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Cross } from '../assets/icons/Cross';
import { User } from '../assets/icons/User';
import { Mail } from '../assets/icons/Mail';
import { Calendar } from '../assets/icons/Calendar';
import { Task } from '../assets/icons/Task';
import { Palette } from '../assets/icons/Palette';
import { Keyboard } from '../assets/icons/Keyboard';
import { Download } from '../assets/icons/Download';
import { Notification } from '../assets/icons/Notification';
import { Contact } from '../assets/icons/Contact';
import { Lightning } from '../assets/icons/Lightning';
import { Logout } from '../assets/icons/Logout';
import { Check } from '../assets/icons/Check';
import { Add } from '../assets/icons/Add';
import { Edit } from '../assets/icons/Edit';
import { More } from '../assets/icons/More';
import { Inbox as InboxAlt } from '../assets/icons/InboxAlt';
import { Tomorrow } from '../assets/icons/Tomorrow';
import { Soon } from '../assets/icons/Soon';
import { Clock } from '../assets/icons/Clock';
import { Drag } from '../assets/icons/Drag';
import { Search } from '../assets/icons/Search';
import { Trash } from '../assets/icons/Trash';
import { TAG_COLORS } from '../constants/colors';

// Directional Hover Button Component
const DirectionalHoverButton = ({ onClick, isActive, icon: Icon, label, isLogout = false }) => {
  const [backgroundState, setBackgroundState] = useState("hidden");
  const [entryDirection, setEntryDirection] = useState({ x: 0, y: 0 });
  const [leaveDirection, setLeaveDirection] = useState({ x: 0, y: 0 });
  const buttonRef = useRef(null);

  // Reset background state when isActive changes
  useEffect(() => {
    if (isActive && !isLogout) {
      setBackgroundState("hidden");
    }
  }, [isActive, isLogout]);

  const calculateDirection = useCallback((e) => {
    if (!buttonRef.current) return { x: 0, y: 0 };
    
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const offsetX = mouseX - centerX;
    const offsetY = mouseY - centerY;
    
    // Reduce travel distance by applying a multiplier (0.3 = 30% of original distance)
    const distanceMultiplier = 0.3;
    
    return { 
      x: offsetX * distanceMultiplier, 
      y: offsetY * distanceMultiplier 
    };
  }, []);

  const handleMouseEnter = useCallback((e) => {
    // Don't show hover effect for active items (except logout)
    if (isActive && !isLogout) return;
    
    const direction = calculateDirection(e);
    setEntryDirection(direction);
    
    // phase 1: instantly spawn at cursor position
    setBackgroundState("entering");
    
    // phase 2: animate to center after a brief moment
    setTimeout(() => {
      setBackgroundState("centered");
    }, 10);
  }, [calculateDirection, isActive, isLogout]);
  
  const handleMouseLeave = useCallback((e) => {
    // Don't show hover effect for active items (except logout)
    if (isActive && !isLogout) return;
    
    const direction = calculateDirection(e);
    setLeaveDirection(direction);
    
    // phase 3: animate to leave direction
    setBackgroundState("leaving");
    
    // reset to hidden after animation completes
    setTimeout(() => {
      setBackgroundState("hidden");
    }, 150);
  }, [calculateDirection, isActive, isLogout]);

  const getBackgroundAnimation = () => {
    switch (backgroundState) {
      case "hidden":
        return {
          opacity: 0,
          x: entryDirection.x,
          y: entryDirection.y,
          scale: 0.3,
          transition: { duration: 0 }
        };
      case "entering":
        return {
          opacity: 0,
          x: entryDirection.x,
          y: entryDirection.y,
          scale: 0.3,
          transition: { duration: 0 }
        };
      case "centered":
        return {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          transition: { duration: 0.1, ease: "easeOut" }
        };
      case "leaving":
        return {
          opacity: 0,
          x: leaveDirection.x,
          y: leaveDirection.y,
          scale: 1,
          transition: { duration: 0.1, ease: "easeOut" }
        };
      default:
        return {
          opacity: 0,
          x: 0,
          y: 0,
          scale: 0.3,
          transition: { duration: 0 }
        };
    }
  };

  const baseClasses = isLogout 
    ? "flex items-center font-medium space-x-3 px-3 py-2 text-red-600 dark:text-red-400 rounded-[9px] transition-colors w-full relative overflow-hidden"
    : `w-full flex items-center font-medium space-x-2 px-2 py-1.5 rounded-[9px] transition-colors relative overflow-hidden hover:text-light-text dark:hover:text-dark-text ${
        isActive
          ? 'bg-black/[0.08] dark:bg-white/5 text-light-text dark:text-dark-text'
          : 'text-light-text/50 dark:text-dark-text/50'
      }`;

  const overlayBgClass = isLogout
    ? "bg-red-50 dark:bg-red-900/20"
    : "bg-light-bg-lighter dark:bg-dark-bg-lighter";

  // Only apply hover styles if not active (except for logout)
  const hoverClasses = (isActive && !isLogout) ? '' : 'hover:bg-transparent';

  return (
    <div className="relative">
      {/* Animated Background */}
      <motion.div
        className={`absolute inset-0 ${overlayBgClass} rounded-[9px]`}
        animate={getBackgroundAnimation()}
      />
      
      <button
        ref={buttonRef}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${baseClasses} ${hoverClasses}`}
      >
        <Icon className="w-4 h-4 relative z-10" />
        <span className="text-sm relative z-10">{label}</span>
      </button>
    </div>
  );
};

const Settings = ({ isOpen, onClose, showTodaysTasks, setShowTodaysTasks }) => {
  const [activeSection, setActiveSection] = useState('profile');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const sliderRef = useRef(null);



  // Handle ESC key to close settings
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Function to get the number of days in a month
  const getDaysInMonth = (monthName) => {
    if (!monthName) return 31;
    
    const monthIndex = months.indexOf(monthName);
    const currentYear = new Date().getFullYear();
    
    // Create a date object for the first day of the next month, then subtract one day
    const daysInMonth = new Date(currentYear, monthIndex + 1, 0).getDate();
    return daysInMonth;
  };

  // Generate days array based on selected month
  const getAvailableDays = () => {
    if (!selectedMonth) return [];
    const maxDays = getDaysInMonth(selectedMonth);
    return Array.from({ length: maxDays }, (_, i) => (i + 1).toString());
  };

  const days = getAvailableDays();

  const filteredMonths = months.filter(month => 
    month.toLowerCase().includes(monthFilter.toLowerCase())
  );

  const filteredDays = days.filter(day => 
    day.includes(dayFilter)
  );

  const handleMonthSelect = (month) => {
    setSelectedMonth(month);
    setMonthFilter(month);
    // Clear day selection when month changes
    setSelectedDay('');
    setDayFilter('');
  };

  const handleDaySelect = (day) => {
    setSelectedDay(day);
    setDayFilter(day);
  };

  const handleMonthInputChange = (e) => {
    const value = e.target.value;
    setMonthFilter(value);
    // Only set selected month if it matches exactly
    const exactMatch = months.find(month => month.toLowerCase() === value.toLowerCase());
    if (exactMatch) {
      setSelectedMonth(exactMatch);
      // Clear day selection when month changes
      setSelectedDay('');
      setDayFilter('');
    } else {
      setSelectedMonth('');
      setSelectedDay('');
      setDayFilter('');
    }
  };

  const handleDayInputChange = (e) => {
    const value = e.target.value;
    setDayFilter(value);
    setSelectedDay(value);
  };
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    desktop: true,
  });

  // Default event color state
  const [defaultEventColor, setDefaultEventColor] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedColor = localStorage.getItem('defaultEventColor');
      return savedColor || '#F59E0B'; // Default to orange
    }
    return '#F59E0B';
  });

  // Default event duration state (in minutes)
  const [defaultEventDuration, setDefaultEventDuration] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedDuration = localStorage.getItem('defaultEventDuration');
      return savedDuration ? parseInt(savedDuration) : 60; // Default to 60 minutes
    }
    return 60;
  });

  // Save default event color to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultEventColor', defaultEventColor);
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('default-event-color-updated', {
        detail: defaultEventColor
      }));
    }
  }, [defaultEventColor]);

  // Save default event duration to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('defaultEventDuration', defaultEventDuration.toString());
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('default-event-duration-updated', {
        detail: defaultEventDuration
      }));
    }
  }, [defaultEventDuration]);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

 

  if (!isOpen) return null;

  const settingsVariants = {
    hidden: {
      scale: 1.05,
      opacity: 0
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: {
        type: "easeInOut",
        duration: 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }
    },
    exit: {
      scale: 1.05,
      opacity: 0,
      transition: {
        type: "easeInOut",
        duration: 0.1,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  const sidebarItems = [
  
    {
      category: 'Personal Settings',
      items: [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'invite', label: 'Invite friends', icon: Mail },
      ]
    },
    {
      category: 'App Settings',
      items: [
        { id: 'calendars', label: 'Calendars', icon: Calendar },
        { id: 'todos', label: 'Tasks', icon: Task },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
        { id: 'download', label: 'Download apps', icon: Download },
      ]
    },
    {
      category: '',
      items: [
        { id: 'whats-new', label: "What's new", icon: Notification },
        { id: 'contact', label: 'Contact us', icon: Contact },
        { id: 'feature-requests', label: 'Feature requests', icon: Lightning },
      ]
    }
  ];

  const renderProfileContent = () => (
    <div className="h-full p-16 max-w-3xl overflow-y-auto">
      <div className="">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Profile</h1>
            <p className="text-light-text/50 dark:text-dark-text/50 mt-1">Manage your profile</p>
          </div>
          <div className="flex flex-col gap-1 items-center absolute top-8 right-8">
          <button
            onClick={onClose}
            className="p-2 hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter rounded-lg transition-colors"
          >
            <Cross className="w-5 h-5 text-light-text/50 dark:text-dark-text/50" />
          </button>
          <span className="tracking-wide font-semibold text-[10px] text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
        </div>

        {/* Profile Avatar */}
        <div className="mb-8 p-10 rounded-[9px] flex flex-col items-center bg-gradient-to-t dark:from-dark-bg-light dark:to-dark-bg from-light-bg-light to-light-bg to-80% border border-light-border dark:border-dark-border">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-semibold">TS</span>
          </div>
          <div className="flex flex-col items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tom Smith</h2>
            <p className="text-gray-600 dark:text-gray-400">youremail@gmail.com</p>
          </div>
        </div>

        {/* Birthday Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Birthday</h3>
          <p className="text-light-text/50 dark:text-dark-text/50 text-sm mb-4">Set your birthday. Only day and month will be visible.</p>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-light-text/50 dark:text-dark-text/50 mb-2">Month</label>
              <Popover>
                <PopoverTrigger asChild>
                  <input
                    type="text"
                    placeholder="eg. March"
                    value={monthFilter}
                    onChange={handleMonthInputChange}
                    className="w-full px-3 py-2 bg-black/[0.08] rounded-[9px] dark:bg-white/[0.08] text-light-text dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-light-border dark:focus:ring-dark-border focus:border-transparent cursor-text"
                  />
                </PopoverTrigger>
                <PopoverContent 
                  align="start" 
                  className="w-48 font-medium overflow-y-auto p-1 max-h-[200px] overflow-y-auto bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-white/20 dark:scrollbar-thumb-white/10"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="space-y-1">
                    {filteredMonths.map((month) => {
                      const isSelected = selectedMonth === month;
                      return (
                        <PopoverPrimitive.Close key={month} asChild>
                          <button
                            onClick={() => handleMonthSelect(month)}
                            className={`flex items-center justify-between w-full text-left px-2 py-1.5 text-xs rounded-[5px] transition-colors hover:bg-white/15 dark:hover:bg-dark-bg-lighter ${
                              isSelected ? 'font-semibold text-dark-text dark:text-dark-text' : 'text-dark-text/50 dark:text-dark-text/50'
                            }`}
                          >
                            <span>{month}</span>
                            {isSelected && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                          </button>
                        </PopoverPrimitive.Close>
                      );
                    })}
                    {filteredMonths.length === 0 && (
                      <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                        No months found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="block text-xs font-medium text-light-text/50 dark:text-dark-text/50 mb-2">Day</label>
              <Popover>
                <PopoverTrigger asChild>
                  <input
                    type="text"
                    placeholder={selectedMonth ? "eg. 11" : "Select month first"}
                    value={dayFilter}
                    onChange={handleDayInputChange}
                    disabled={!selectedMonth}
                    className={`w-full px-3 py-2 bg-black/[0.08] rounded-[9px] dark:bg-white/[0.08] text-light-text dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-light-border dark:focus:ring-dark-border focus:border-transparent ${
                      selectedMonth ? 'cursor-text' : 'cursor-not-allowed opacity-50'
                    }`}
                  />
                </PopoverTrigger>
                <PopoverContent 
                  align="start" 
                  className="w-[120px] p-1 max-h-[200px] overflow-y-auto bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border scrollbar-thin scrollbar-thumb-rounded scrollbar-track-transparent scrollbar-thumb-white/20 dark:scrollbar-thumb-white/10"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div>
                    {filteredDays.map((day) => {
                      const isSelected = selectedDay === day;
                      return (
                        <PopoverPrimitive.Close key={day} asChild>
                          <button
                            onClick={() => handleDaySelect(day)}
                            className={`flex items-center justify-between w-full text-left px-1.5 py-1.5 text-xs rounded-[5px] transition-colors hover:bg-white/15 dark:hover:bg-dark-bg-lighter ${
                              isSelected ? 'font-semibold text-dark-text dark:text-dark-text' : 'text-dark-text/50 dark:text-dark-text/50'
                            }`}
                          >
                            <span>{day}</span>
                            {isSelected && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                          </button>
                        </PopoverPrimitive.Close>
                      );
                    })}
                    {filteredDays.length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No days found
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Location Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Location</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Set your current location.</p>
          <input
            type="text"
            placeholder="e.g Berlin, Germany"
            className="w-full px-3 py-2 bg-black/[0.08] rounded-[9px] dark:bg-white/[0.08] text-light-text dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-light-border dark:focus:ring-dark-border focus:border-transparent"
          />
        </div>

        {/* Danger Zone */}
        <div className="border-t border-light-border dark:border-dark-border pt-8">
          <h3 className="text-lg font-medium text-red-600 mb-2">Danger zone</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">Delete your account and all your data.</p>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
            Delete account
          </button>
        </div>

      </div>
    </div>
  );

  const renderAppearanceContent = () => (
    <div className="h-full p-16 max-w-3xl overflow-y-auto">
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Appearance</h1>
            <p className="text-light-text/50 dark:text-dark-text/50 mt-1">Customize how Chrono looks and feels</p>
          </div>
          
          <div className="flex flex-col gap-1 items-center absolute top-8 right-8">
            <button
              onClick={onClose}
              className="p-2 hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter rounded-lg transition-colors"
            >
              <Cross className="w-5 h-5 text-light-text/50 dark:text-dark-text/50" />
            </button>
            <span className="tracking-wide font-semibold text-[10px] text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
        </div>
        <div className="h-[1px] w-full bg-light-border dark:bg-dark-border">

            </div>

        {/* Theme Section */}
        <div className="mb-8">
          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-1">Theme</h3>
          <p className="text-light-text/50 dark:text-dark-text/50 text-sm mb-6">Select your preferred theme</p>
          
          <div className="grid grid-cols-3 gap-4"><div className="relative flex flex-col items-center w-full h-44 gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`relative p-4 h-44 w-full overflow-hidden rounded-lg border-2 ${
                mounted && theme === 'light'
                  ? 'border-primary bg-light-bg-light'
                  : 'border-light-border dark:border-dark-border'
              }`}
            >
              <div className="absolute top-4 w-64 h-36 bg-light-bg rounded-md border border-light-border dark:border-dark-border overflow-hidden">
                <div className="h-6 bg-light-bg-lighter flex items-center px-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  </div>
                </div>
                <div className="p-2 space-y-2">
                  <div className="h-2 bg-light-bg-lighter rounded w-3/4"></div>
                  <div className="h-2 bg-light-bg-lighter rounded w-1/2"></div>
                  <div className="h-2 bg-light-bg-lighter rounded w-1/4"></div>
                </div>
              </div>
              
              {mounted && theme === 'light' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-light-text dark:text-dark-text" />
                </div>
              )}
            </button>
            <div className="text-center">
                <h4 className="font-medium text-sm text-light-text/50 dark:text-dark-text/50">Light</h4>
              </div>
            </div>

            {/* Dark Theme */}
            <div className="relative flex flex-col items-center w-full h-44 gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`relative p-4 h-44 w-full overflow-hidden rounded-lg border-2 ${
                mounted && theme === 'dark'
                  ? 'border-primary bg-light-bg-light dark:bg-dark-bg-light'
                  : 'border-light-border dark:border-dark-border'
              }`}
            >
              <div className="absolute top-4 w-64 h-36 bg-dark-bg rounded-md border border-light-border dark:border-dark-border overflow-hidden">
                <div className="h-6 bg-dark-bg-lighter flex items-center px-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  </div>
                </div>
                <div className="p-2 space-y-2">
                  <div className="h-2 bg-dark-bg-lighter rounded w-3/4"></div>
                  <div className="h-2 bg-dark-bg-lighter rounded w-1/2"></div>
                  <div className="h-2 bg-dark-bg-lighter rounded w-1/4"></div>
                </div>
              </div>
              
              {mounted && theme === 'dark' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-light-text dark:text-dark-text" />
                </div>
              )}
            </button>
            <div className="text-center">
                <h4 className="font-medium text-sm text-light-text/50 dark:text-dark-text/50">Dark</h4>
              </div>
            </div>

            {/* System Theme */}
            <div className="relative flex flex-col items-center w-full h-44 gap-2">
            <button
              onClick={() => setTheme('system')}
              className={`relative p-4 h-44 w-full overflow-hidden rounded-lg border-2 ${
                mounted && theme === 'system'
                  ? 'bg-light-bg-light dark:bg-dark-bg-light border-primary'
                  : 'border-light-border dark:border-dark-border'
              }`}
            >
              <div className="aspect-[4/3] rounded-md mb-3 w-64 overflow-hidden relative">
                {/* Split design showing both light and dark */}
                <div className="absolute inset-0 flex">
                  {/* Light half */}
                  <div className="w-2/5 bg-light-bg border-r border-light-border">
                    <div className="h-6 bg-light-bg-lighter flex items-center px-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      </div>
                    </div>
                    <div className="p-1.5 space-y-2">
                      <div className="h-1.5 bg-light-bg-lighter rounded w-3/4"></div>
                      <div className="h-1.5 bg-light-bg-lighter rounded w-1/2"></div>
                      <div className="h-1.5 bg-light-bg-lighter rounded w-1/4"></div>

                    </div>
                  </div>
                  {/* Dark half */}
                  <div className="w-1/2 bg-dark-bg">
                    <div className="h-6 bg-dark-bg-lighter flex items-center px-2">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                      </div>
                    </div>
                    <div className="p-1.5 space-y-2">
                      <div className="h-1.5 bg-dark-bg-lighter rounded w-3/4"></div>
                      <div className="h-1.5 bg-dark-bg-lighter rounded w-1/2"></div>
                      <div className="h-1.5 bg-dark-bg-lighter rounded w-1/4"></div>

                    </div>
                  </div>
                </div>
                <div className="absolute inset-0 border border-light-border dark:border-dark-border rounded-md"></div>
              </div>
              
              {mounted && theme === 'system' && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-light-text dark:text-dark-text" />
                </div>
              )}
            </button>
            <div className="text-center">
                <h4 className="font-medium text-sm text-light-text/50 dark:text-dark-text/50">System</h4>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Preview Component that mimics TodaysTasksProgress styling
  const TodaysTasksPreview = ({ isVisible }) => {
    const [animatedProgress, setAnimatedProgress] = useState(0);
    const progressPercentage = 67; // Mock data for preview
    const completedTasks = 2;
    const totalTasks = 3;

    useEffect(() => {
      if (isVisible) {
        const timer = setTimeout(() => {
          setAnimatedProgress(progressPercentage);
        }, 100);
        return () => clearTimeout(timer);
      } else {
        setAnimatedProgress(0);
      }
    }, [isVisible, progressPercentage]);

    if (!isVisible) return null;

    return (
      <div className="w-[228px]">
        <div className="bg-light-bg-lighter p-0.5 dark:bg-dark-bg-lighter rounded-[7px]">
          {/* Header */}
          <div className="bg-light-bg dark:bg-dark-bg-light shadow-sm w-fill p-2 rounded-[5px]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-light-text dark:text-dark-text">
                Today's tasks
              </h3>
              <span className="text-xs text-light-text/60 dark:text-dark-text/60">
                {progressPercentage}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="">
              <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${animatedProgress}%` }}
                  transition={{
                    duration: 0.2,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                />
              </div>
            </div>
          </div>

          {/* Task Count */}
          <div className="flex items-center justify-between text-xs p-2 pr-1 pb-1 text-light-text/60 dark:text-dark-text/60">
            <span>{completedTasks}/{totalTasks} Completed</span>
            <button className="flex items-center justify-center p-1 h-6 rounded-[5px] hover:bg-light-border dark:hover:bg-dark-border transition-colors opacity-60 hover:opacity-100">
              <Add className="w-3 h-3" />
              <span className="text-xs p-1">Add</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Tag Groups Management State
  const [tagGroups, setTagGroups] = useState(() => {
    // Initialize with default tags
    const defaultTags = [
      { id: "work", label: "Work", color: "#EF4444" },
      { id: "family", label: "Family", color: "#3B82F6" },
      { id: "personal", label: "Personal", color: "#A855F7" },
      { id: "travel", label: "Travel", color: "#22C55E" },
    ];

    // Try to load from localStorage (only in browser)
    if (typeof window !== 'undefined') {
      const savedTags = localStorage.getItem("tags");
      if (savedTags) {
        try {
          return JSON.parse(savedTags);
        } catch (e) {
          // Error parsing tags
        }
      }
    }
    return defaultTags;
  });
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  
  // Color menu state
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [colorMenuPosition, setColorMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedTagId, setSelectedTagId] = useState(null);

  // @dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save tag groups to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("tags", JSON.stringify(tagGroups));
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('tags-updated', {
        detail: tagGroups
      }));
    }
  }, [tagGroups]);

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = tagGroups.findIndex((tag) => tag.id === active.id);
      const newIndex = tagGroups.findIndex((tag) => tag.id === over.id);

      setTagGroups((tags) => {
        return arrayMove(tags, oldIndex, newIndex);
      });
    }
  };

  const handleAddTag = () => {
    if (newTagName.trim()) {
      const newTag = {
        id: `tag-${Date.now()}`,
        label: newTagName.trim(),
        color: "#3B82F6" // Default blue color
      };
      setTagGroups([...tagGroups, newTag]);
      setNewTagName("");
      setIsAddingTag(false);
    }
  };

  const handleDeleteTag = (tagId) => {
    setTagGroups(tagGroups.filter(tag => tag.id !== tagId));
  };

  const handleRenameTag = (tagId, newName) => {
    if (newName.trim()) {
      setTagGroups(tagGroups.map(tag => 
        tag.id === tagId ? { ...tag, label: newName.trim() } : tag
      ));
    }
    setEditingTagId(null);
    setEditingTagName("");
  };

  const filteredTagGroups = tagGroups.filter(tag => 
    tag.label.toLowerCase().includes(tagFilter.toLowerCase())
  );

  // Sortable Tag Item Component
  const SortableTagItem = ({ tag }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: tag.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`flex items-center gap-3 p-3 bg-light-bg-light dark:bg-dark-bg-light
           rounded-lg border border-light-border dark:border-dark-border ${
          isDragging ? '' : ''
        }`}
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-move"
        >
          <Drag className="w-4 h-4 text-light-text/30 dark:text-dark-text/30" />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <div 
            className="w-3 h-3 rounded-[5px]" 
            style={{ backgroundColor: tag.color }}
          ></div>
          {editingTagId === tag.id ? (
            <input
              type="text"
              value={editingTagName}
              onChange={(e) => setEditingTagName(e.target.value)}
              onBlur={() => handleRenameTag(tag.id, editingTagName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRenameTag(tag.id, editingTagName);
                } else if (e.key === 'Escape') {
                  setEditingTagId(null);
                  setEditingTagName("");
                }
              }}
              className="bg-transparent border-none outline-none text-sm text-light-text dark:text-dark-text min-w-0 flex-1"
              autoFocus
            />
          ) : (
            <span 
              className="text-sm text-light-text dark:text-dark-text cursor-pointer"
              onDoubleClick={() => {
                setEditingTagId(tag.id);
                setEditingTagName(tag.label);
              }}
            >
              {tag.label}
            </span>
          )}

        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setColorMenuPosition({
                x: rect.right + 5,
                y: rect.top
              });
              setSelectedTagId(tag.id);
              setColorMenuOpen(true);
            }}
            className="p-1 hover:bg-light-border dark:hover:bg-dark-border rounded transition-colors"
          >
            <More className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
          </button>
        </div>
      </div>
    );
  };

  const renderTodosContent = () => (
    <div className="h-full flex">
      {/* Main Content */}
      <div className="flex-1 p-16 overflow-y-auto">
        <div className="max-w-2xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Tasks</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your task settings</p>
            </div>
            <div className="flex flex-col gap-1 items-center absolute top-8 right-8">
              <button
                onClick={onClose}
                className="p-2 hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter rounded-lg transition-colors"
              >
                <Cross className="w-5 h-5 text-light-text/50 dark:text-dark-text/50" />
              </button>
              <span className="tracking-wide font-semibold text-[10px] text-light-text/50 dark:text-dark-text/50">ESC</span>
            </div>
          </div>
          
          {/* Today's Tasks Toggle */}
          <div className="space-y-6">
            <div className="h-[1px] w-full bg-light-border dark:bg-dark-border">

            </div>
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-md font-medium text-gray-900 dark:text-white">Today's Tasks</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Show the Today's Tasks progress widget in the sidebar
                  </p>
                </div>
                <button
                  onClick={() => setShowTodaysTasks(!showTodaysTasks)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-light-border dark:focus:ring-dark-border ${
                    showTodaysTasks ? 'bg-primary' : 'bg-black/10 dark:bg-white/10'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showTodaysTasks ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Tag Groups Section */}
            <div className="h-[1px] w-full bg-light-border dark:bg-dark-border"></div>
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-md font-medium text-gray-900 dark:text-white">Tag Groups</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Use tag groups to better organize and filter tasks in your workspace.
                  </p>
                </div>
                
              </div>

              {/* Filter Input */}
              

              {/* Default Lists */}
              <div className="mb-6">
                <h4 className="text-xs font-medium text-light-text/50 dark:text-dark-text/50 mb-3">Default tag groups</h4>
                <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 px-0 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">Overdue</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Tasks that are passed scheduled date</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 px-0 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">Today</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Tasks that are passed scheduled date</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 px-0 rounded-lg">
                    <div className="flex items-center gap-2">
                      <InboxAlt className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">Inbox</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Tasks that are unsorted</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 px-0 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Tomorrow className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">Tomorrow</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Tasks that are due tomorrow</span>
                  </div>
                  <div className="flex items-center gap-3 p-2 px-0 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Soon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">Soon</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">Tasks that are due within the next 7 days</span>
                  </div>
                </div>
                
              </div>
              

              {/* Drag to reorder hint */}
               <div className="flex items-center gap-1 mb-4">
                 <Drag className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                 <span className="text-xs text-light-text/50 dark:text-dark-text/50">Drag to reorder</span>
               </div>
               <div className="mb-4 flex flex-row items-center justify-between">
                <div className="relative">
                  <span className="absolute top-1/2 -translate-y-1/2 left-3">
                    <Search className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                  </span>
                <input
                  type="text"
                  placeholder="Filter by name"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="w-56 px-3 pl-9 py-2 bg-black/[0.08] rounded-[9px] dark:bg-white/[0.08] text-light-text dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-light-border dark:focus:ring-dark-border focus:border-transparent text-sm"
                />
                </div>
                <button
                  onClick={() => setIsAddingTag(true)}
                  className="px-1.5 py-1.5 h-[36px] bg-black text-white dark:bg-white dark:text-black rounded-[9px] text-sm font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex items-center"
                >
                  <Add className="w-4 h-4" />
                  <span className="text-sm px-1">New tag</span>
                </button>
              </div>

              {/* Tag Groups List */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={filteredTagGroups.map(tag => tag.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {filteredTagGroups.map((tag) => (
                      <SortableTagItem key={tag.id} tag={tag} />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

                {/* Add New Tag Input */}
                {isAddingTag && (
                  <div className="flex mt-2 items-center gap-3 p-3 rounded-lg border border-dashed border-light-border dark:border-dark-border bg-light-bg-lighter dark:bg-dark-bg-lighter">
                    <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onBlur={() => {
                        if (!newTagName.trim()) {
                          setIsAddingTag(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddTag();
                        } else if (e.key === 'Escape') {
                          setIsAddingTag(false);
                          setNewTagName("");
                        }
                      }}
                      placeholder="Tag group name"
                      className="bg-transparent border-none outline-none text-sm text-light-text dark:text-dark-text placeholder-gray-500 dark:placeholder-gray-400 flex-1"
                      autoFocus
                    />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleAddTag}
                        className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors"
                      >
                        <Check className="w-4 h-4 text-green-500" />
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingTag(false);
                          setNewTagName("");
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <Cross className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      </div>

      

  );

  const renderCalendarsContent = () => (
    <div className="h-full p-16 max-w-3xl overflow-y-auto select-none">
      <div className="">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Calendars</h1>
            <p className="text-light-text/50 dark:text-dark-text/50 mt-1">Manage your calendar settings</p>
          </div>
          <div className="flex flex-col gap-1 items-center absolute top-8 right-8">
            <button
              onClick={onClose}
              className="p-2 hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter rounded-lg transition-colors"
            >
              <Cross className="w-5 h-5 text-light-text/50 dark:text-dark-text/50" />
            </button>
            <span className="tracking-wide font-semibold text-[10px] text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
        </div>

        {/* Default Event Color Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Default Event Color</h3>
          <p className="text-light-text/50 dark:text-dark-text/50 text-sm mb-4">Choose the default color for new events.</p>
          
          <div className="flex flex-wrap gap-3">
            {TAG_COLORS.map((color) => {
              const isSelected = defaultEventColor === color;
              return (
                <motion.button
                  key={color}
                  className={`relative w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center border-2 ${
                    isSelected ? 'border-light-text dark:border-dark-text' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setDefaultEventColor(color)}
                >
                  {isSelected && (
                    <Check className="w-5 h-5 text-white" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="w-full h-[1px] bg-light-border dark:bg-dark-border mb-8">

        </div>

        {/* Default Event Duration Section */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Default duration</h3>
          <p className="text-light-text/50 dark:text-dark-text/50 text-sm mb-4">Set how long new events should be by default.</p>
          
          <div>
            
            {/* Custom Animated Slider */}
            <div className="relative" ref={sliderRef}>
              {/* Friction points indicators */}
              <div className="absolute inset-0 flex justify-between items-center pointer-events-none">
                {[15, 30, 45, 60, 90].map((point) => {
              const position = ((point - 15) / (90 - 15)) * 100;
                  return (
                    <div
                      key={point}
                      className="absolute w-1 h-4 rounded-full"
                      style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                    />
                  );
                })}
              </div>
              
              <div 
                ref={sliderRef}
                className="w-full h-10 border border-light-border dark:border-dark-border bg-light-bg-light dark:bg-dark-bg-lighter rounded-[9px] cursor-pointer relative"
                onClick={(e) => {
                  const rect = sliderRef.current.getBoundingClientRect();
                  const currentX = e.clientX - rect.left;
                  const percentage = Math.max(0, Math.min(1, currentX / rect.width));
                  let newDuration = Math.round(15 + (percentage * (90 - 15)));
                  
                  // Add friction points with snapping
                  const frictionPoints = [15, 30, 45, 60, 90];
                  const snapThreshold = 3; // minutes
                  
                  for (const point of frictionPoints) {
                    if (Math.abs(newDuration - point) <= snapThreshold) {
                      newDuration = point;
                      break;
                    }
                  }
                  
                  // Round to nearest 5 minutes if not snapped to friction point
                  if (!frictionPoints.includes(newDuration)) {
                    newDuration = Math.round(newDuration / 5) * 5;
                  }
                  
                  const finalDuration = Math.max(15, Math.min(90, newDuration));
                  setDefaultEventDuration(finalDuration);
                }}
              >
                <motion.div 
                  className="relative h-10 bg-light-bg-lighter dark:bg-white/5 rounded-[9px]"
                  animate={{ width: `${Math.max(10, ((defaultEventDuration - 15) / (90 - 15)) * 90) + 10}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  {/* Duration text positioned on the left */}
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-xs font-medium text-light-text dark:text-dark-text pointer-events-none">
                    {defaultEventDuration} min
                  </div>
                  {/* Simple handle at the end */}
                  <div className="absolute w-[8px] h-full bg-white/5 right-0 top-0 rounded-r-[9px]" />
                </motion.div>
              </div>

            </div>
            
            {/* Duration presets */}
            <div className="flex gap-2 mt-4">
              {[15, 30, 45, 60, 90].map((duration) => (
                <motion.button
                  key={duration}
                  onClick={() => setDefaultEventDuration(duration)}
                  className={`px-3 py-1.5 text-xs rounded-[5px] transition-colors ${
                    defaultEventDuration === duration
                      ? 'bg-primary dark:text-light-text text-dark-text'
                      : 'bg-light-bg-light dark:bg-white/5 text-light-text/70 dark:text-dark-text/70 hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter'
                  }`}

                  whileTap={{ scale: 0.98 }}
                >
                  {duration}m
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Future calendar settings can be added here */}
        <div className="border-t border-light-border dark:border-dark-border pt-8">
          <div className="text-light-text/50 dark:text-dark-text/50">
            <p>Additional calendar settings will be available here in future updates.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDefaultContent = () => (
    <div className="h-full p-16 overflow-y-auto">
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white capitalize">{activeSection}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your {activeSection} settings</p>
          </div>
          <div className="flex flex-col gap-1 items-center absolute top-8 right-8">
          <button
            onClick={onClose}
            className="p-2 hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter rounded-lg transition-colors"
          >
            <Cross className="w-5 h-5 text-light-text/50 dark:text-dark-text/50" />
          </button>
          <span className="tracking-wide font-semibold text-[10px] text-light-text/50 dark:text-dark-text/50">ESC</span>
          </div>
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          <p>Settings for {activeSection} will be implemented here.</p>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div 
      className="fixed inset-0 bg-light-bg dark:bg-dark-bg z-50 flex overflow-hidden"
      variants={settingsVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Sidebar */}
      <div className="w-[600px] h-full bg-light-bg-light dark:bg-dark-bg-light border-r border-light-border dark:border-dark-border overflow-y-auto flex justify-end">
        <div className="p-6 pt-16 w-64">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-300 text-sm font-medium">TS</span>
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">Tom Smith</h2>
              <p className="text-sm text-light-text/50 dark:text-dark-text/50">Workspace Settings</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-6">
            {sidebarItems.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.category && (
                  <h3 className="text-xs font-medium text-light-text/50 dark:text-dark-text/50 mb-3">
                    {section.category}
                  </h3>
                )}
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.id}>
                        <DirectionalHoverButton
                          onClick={() => setActiveSection(item.id)}
                          isActive={activeSection === item.id}
                          icon={Icon}
                          label={item.label}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Logout */}
          <div className="mt-8 pt-6 border-t border-light-border dark:border-dark-border">
            <DirectionalHoverButton
              onClick={() => {}}
              isActive={false}
              icon={Logout}
              label="Log out"
              isLogout={true}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-full">
        {activeSection === 'profile' ? renderProfileContent() : 
         activeSection === 'calendars' ? renderCalendarsContent() :
         activeSection === 'todos' ? renderTodosContent() : 
         activeSection === 'appearance' ? renderAppearanceContent() :
         renderDefaultContent()}
      </div>
      
      {/* Color Picker Menu */}
      {colorMenuOpen && (
        <div className="fixed top-0 left-0 z-50 pointer-events-none" style={{ transform: `translate(${colorMenuPosition.x}px, ${colorMenuPosition.y}px)` }}>
          <Popover open={true} onOpenChange={(open) => !open && setColorMenuOpen(false)}>
            <PopoverTrigger asChild>
              <div className="w-0 h-0" />
            </PopoverTrigger>
            <PopoverContent
              className="p-0 bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md outline outline-1 outline-dark-border dark:outline-dark-border"
              align="start"
              side="right"
              sideOffset={5}
              avoidCollisions={true}
              style={{ width: 'auto' }}
            >
              <div className="pointer-events-auto">
                <div className="flex flex-wrap gap-2 pb-1 p-3" style={{ maxWidth: '280px' }}>
                  {TAG_COLORS.map((color) => {
                    const selectedTag = tagGroups.find(t => t.id === selectedTagId);
                    const isSelected = selectedTag && selectedTag.color === color;
                    return (
                      <motion.div
                        key={color}
                        className={`relative w-5 h-5 rounded-md cursor-pointer flex items-center justify-center`}
                        style={{ backgroundColor: color }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          const updatedTags = tagGroups.map((t) =>
                            t.id === selectedTagId ? { ...t, color: color } : t
                          );
                          setTagGroups(updatedTags);
                          setColorMenuOpen(false);
                        }}
                      >
                        {isSelected && (
                          <Check className="w-4 h-4 text-white" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="pt-1">
                  {selectedTagId && (
                    <>
                      <div className="border-t border-light-border-2 dark:border-dark-border mt-2" />
                      <div className="p-1 space-y-1">
                        <button
                          className="w-full group flex items-center gap-2 text-left px-2 py-2 rounded-[5px] font-medium text-xs text-light-text dark:text-dark-text hover:bg-white/15 dark:hover:bg-white/10"
                          onClick={() => {
                            const tagToRename = tagGroups.find(t => t.id === selectedTagId);
                            if (tagToRename) {
                              setEditingTagId(selectedTagId);
                              setEditingTagName(tagToRename.label);
                            }
                            setColorMenuOpen(false);
                          }}
                        >
                          <Edit className="w-3 h-3 text-white/50 group-hover:text-white" />
                          <span className="text-white"> Rename </span>
                        </button>
                        <button
                          className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-[5px] font-medium text-xs text-red-500 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                          onClick={() => {
                            handleDeleteTag(selectedTagId);
                            setColorMenuOpen(false);
                          }}
                        >
                          <Trash className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </motion.div>
  );
};

export default Settings;