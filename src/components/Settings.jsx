'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import * as PopoverPrimitive from '@radix-ui/react-popover';
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
    ? "flex items-center font-medium space-x-3 px-3 py-2 text-red-600 dark:text-red-400 rounded-lg transition-colors w-full relative overflow-hidden"
    : `w-full flex items-center font-medium space-x-2 px-2 py-1.5 rounded-[9px] transition-colors relative overflow-hidden ${
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
        className={`absolute inset-0 ${overlayBgClass} rounded-lg`}
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
  const [theme, setTheme] = useState('system');
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    desktop: true,
  });

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

  const renderTodosContent = () => (
    <div className="h-full p-16 overflow-y-auto">
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
          <div className="h-[1px] w-full bg-light-border dark:bg-border-dark">

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
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-light-border dark:focus:ring-dark-border focus:ring-offset-2 ${
                  showTodaysTasks ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
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
         activeSection === 'todos' ? renderTodosContent() : 
         renderDefaultContent()}
      </div>
    </motion.div>
  );
};

export default Settings;