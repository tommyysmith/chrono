'use client';

import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { format, isToday, isTomorrow, isSameDay } from 'date-fns';
import { useCommandBar, VIEW_MODES } from '../CommandBarContext';
import { Task } from '../../../assets/icons/Task';
import { Calendar as CalendarIcon } from '../../../assets/icons/Calendar';
import { Tag } from '../../../assets/icons/Tag';
import { Repeat } from '../../../assets/icons/Repeat';
import { Check } from '../../../assets/icons/Check';
import { Add } from '../../../assets/icons/Add';
import { Anytime } from '../../../assets/icons/Anytime';
import { Tomorrow } from '../../../assets/icons/Tomorrow';
import { Soon } from '../../../assets/icons/Soon';
import { None } from '../../../assets/icons/None';
import { Low } from '../../../assets/icons/Low';
import { Medium } from '../../../assets/icons/Medium';
import { High } from '../../../assets/icons/High';
import { Calendar } from '@/components/ui/calendar';
import { RRule, Weekday } from 'rrule';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import RecurrenceModal from '../../RecurrenceModal';
import FormFooter from '../components/FormFooter';
import { TAG_COLORS } from '../../../constants/colors';

const SCHEDULE_OPTIONS = [
  { id: 'anytime', label: 'Anytime', icon: Anytime, color: '#6B7280' },
  { id: 'today', label: 'Today', icon: CalendarIcon, color: '#EF4444' },
  { id: 'tomorrow', label: 'Tomorrow', icon: Tomorrow, color: '#3B82F6' },
  { id: 'nextWeek', label: 'Next week', icon: Soon, color: '#A855F7' },
  { id: 'custom', label: 'Pick a date...' }
];

const REPEAT_OPTIONS = [
  { id: 'none', label: 'Does not repeat' },
  { id: 'daily', label: 'Every day' },
  { id: 'weekday', label: 'Every weekday', sublabel: 'Mon – Fri' },
  { id: 'weekly', label: 'Every week', sublabel: 'on Mon' },
  { id: 'biweekly', label: 'Every 2 weeks', sublabel: 'on Mon' },
  { id: 'monthly', label: 'Every month', sublabel: 'on the 30th' },
  { id: 'monthlyWeekday', label: 'Every month', sublabel: 'on the 5th Mon' },
  { id: 'monthlyLastWeekday', label: 'Every month', sublabel: 'on the last Mon' },
  { id: 'yearly', label: 'Every year', sublabel: 'on Dec 30' },
  { id: 'custom', label: 'Custom...' }
];

const PRIORITY_OPTIONS = [
  { id: 'High', label: 'High', color: '#EF4444' },
  { id: 'Medium', label: 'Medium', color: '#F59E0B' },
  { id: 'Low', label: 'Low', color: '#10B981' },
  { id: 'None', label: 'None', color: '#6B7280' }
];

const getPriorityIcon = (priorityId) => {
  switch (priorityId) {
    case 'High': return High;
    case 'Medium': return Medium;
    case 'Low': return Low;
    case 'None':
    default: return None;
  }
};

const getRepeatDisplayText = (repeatValue, rruleOptions) => {
  if (repeatValue === 'custom' && rruleOptions) {
    try {
      const options = { ...rruleOptions };
      if (options.dtstart) {
        options.dtstart = new Date(options.dtstart);
      }
      if (options.byweekday) {
        options.byweekday = options.byweekday.map(day => {
          if (day instanceof Weekday) return day;
          if (typeof day === 'number') return new Weekday(day);
          if (day.weekday !== undefined) return new Weekday(day.weekday);
          return RRule[day];
        });
      }
      const rule = new RRule(options);
      return rule.toText();
    } catch (e) {
      return 'Custom';
    }
  }
  return REPEAT_OPTIONS.find(option => option.id === repeatValue)?.label || 'Does not repeat';
};

function TaskForm({ onCreateTask, onUpdateTask, tags: initialTags = [] }) {
  const { editingTask, close, openEventForm } = useCommandBar();
  const titleInputRef = useRef(null);
  
  // Local form state - isolated from global state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [priority, setPriority] = useState('None');
  const [repeatOption, setRepeatOption] = useState('none');
  const [rruleOptions, setRruleOptions] = useState(null);
  const [seriesId, setSeriesId] = useState(null);
  
  // UI state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [tagSearchText, setTagSearchText] = useState('');
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [isRepeatOpen, setIsRepeatOpen] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [tags, setTags] = useState(initialTags);
  const [pendingNewTag, setPendingNewTag] = useState(null);

  // Initialize form when editing task changes
  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title || '');
      setNotes(editingTask.notes || '');
      setScheduledDate(editingTask.scheduledDate ? new Date(editingTask.scheduledDate) : null);
      setSelectedTag(editingTask.tag || null);
      setPriority(editingTask.priority || 'None');
      setRepeatOption(editingTask.repeat || 'none');
      setRruleOptions(editingTask.rruleOptions || null);
      setSeriesId(editingTask.seriesId || null);
    } else {
      // Reset form for new task
      setTitle('');
      setNotes('');
      setScheduledDate(null);
      setSelectedTag(null);
      setPriority('None');
      setRepeatOption('none');
      setRruleOptions(null);
      setSeriesId(null);
    }
  }, [editingTask]);

  // Focus title input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Load tags from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTags = localStorage.getItem('tags');
      if (savedTags) {
        setTags(JSON.parse(savedTags));
      }
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;

    // Save pending new tag if exists
    let finalTag = selectedTag;
    if (pendingNewTag) {
      const updatedTags = [...tags, pendingNewTag];
      setTags(updatedTags);
      localStorage.setItem('tags', JSON.stringify(updatedTags));
      window.dispatchEvent(new CustomEvent('tags-updated', { detail: updatedTags }));
      finalTag = pendingNewTag;
    }

    const taskSeriesId = repeatOption !== 'none'
      ? (seriesId || `series_${Date.now().toString()}`)
      : null;

    const taskData = {
      id: editingTask?.id || Date.now().toString(),
      title: title.trim(),
      notes: notes.trim(),
      tag: finalTag,
      priority,
      scheduledDate: (repeatOption && repeatOption !== 'none') ? undefined : scheduledDate?.toISOString(),
      completed: editingTask?.completed || false,
      createdAt: editingTask?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repeat: repeatOption !== 'none' ? repeatOption : 'none',
      rruleOptions: repeatOption !== 'none' ? rruleOptions : null,
      seriesId: taskSeriesId,
      isRepeat: editingTask?.isRepeat || false,
      originalBaseId: editingTask?.originalBaseId,
      _editScope: editingTask?._editScope,
      _updateSeries: editingTask?._updateSeries,
    };

    // Preserve original scheduled date for recurring tasks
    if (repeatOption && repeatOption !== 'none' && scheduledDate) {
      taskData._originalScheduledDate = scheduledDate.toISOString();
    }

    if (editingTask?.id) {
      onUpdateTask?.(taskData);
    } else {
      onCreateTask?.(taskData);
    }

    close();
  }, [title, notes, selectedTag, pendingNewTag, priority, scheduledDate, repeatOption, rruleOptions, seriesId, editingTask, tags, onCreateTask, onUpdateTask, close]);

  const handleTabChange = useCallback((tab) => {
    if (tab === 'event') {
      openEventForm();
    }
  }, [openEventForm]);

  const handleScheduleSelect = useCallback((optionId) => {
    if (optionId === 'custom') {
      setIsDatePickerOpen(true);
      setIsScheduleOpen(false);
    } else if (optionId === 'anytime') {
      setScheduledDate(null);
      setIsScheduleOpen(false);
    } else {
      const date = new Date();
      if (optionId === 'tomorrow') {
        date.setDate(date.getDate() + 1);
      } else if (optionId === 'nextWeek') {
        date.setDate(date.getDate() + 7);
      }
      setScheduledDate(date);
      setIsScheduleOpen(false);
    }
  }, []);

  const handleRepeatSelect = useCallback((optionId) => {
    if (optionId === 'custom') {
      setIsRecurrenceModalOpen(true);
      setIsRepeatOpen(false);
    } else {
      setRepeatOption(optionId);
      setRruleOptions(null);
      if (repeatOption === 'none' && optionId !== 'none') {
        setSeriesId(`series_${Date.now().toString()}`);
      } else if (optionId === 'none') {
        setSeriesId(null);
      }
      setIsRepeatOpen(false);
    }
  }, [repeatOption]);

  const handleSaveRecurrenceRule = useCallback((newOptions) => {
    setRepeatOption('custom');
    setRruleOptions(newOptions);
    if (!seriesId) {
      setSeriesId(`series_${Date.now().toString()}`);
    }
    setIsRecurrenceModalOpen(false);
  }, [seriesId]);

  const handleTagSelect = useCallback((tag) => {
    setSelectedTag(tag);
    setTagSearchText('');
    setIsTagDropdownOpen(false);
  }, []);

  const handleCreateTag = useCallback(() => {
    if (!tagSearchText) return;
    const randomColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const newTag = {
      id: tagSearchText.toLowerCase().replace(/\s+/g, '-'),
      label: tagSearchText,
      color: randomColor
    };
    setPendingNewTag(newTag);
    setSelectedTag(newTag);
    setTagSearchText('');
    setIsTagDropdownOpen(false);
  }, [tagSearchText]);

  // Check if editing a recurring task (disable schedule editing)
  const isEditingRecurringTask = editingTask && editingTask.seriesId && 
    (editingTask.repeat || editingTask.isRepeat) && editingTask._editScope !== 'single';

  // Get schedule icon based on selected date
  const getScheduleIcon = () => {
    if (!scheduledDate) {
      const option = SCHEDULE_OPTIONS.find(opt => opt.id === 'anytime');
      return option?.icon || CalendarIcon;
    }
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (isToday(scheduledDate)) {
      return SCHEDULE_OPTIONS.find(opt => opt.id === 'today')?.icon || CalendarIcon;
    }
    if (isTomorrow(scheduledDate)) {
      return SCHEDULE_OPTIONS.find(opt => opt.id === 'tomorrow')?.icon || CalendarIcon;
    }
    if (isSameDay(scheduledDate, nextWeek)) {
      return SCHEDULE_OPTIONS.find(opt => opt.id === 'nextWeek')?.icon || CalendarIcon;
    }
    return CalendarIcon;
  };

  const getScheduleIconColor = () => {
    if (!scheduledDate) return SCHEDULE_OPTIONS.find(opt => opt.id === 'anytime')?.color;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    if (isToday(scheduledDate)) return SCHEDULE_OPTIONS.find(opt => opt.id === 'today')?.color;
    if (isTomorrow(scheduledDate)) return SCHEDULE_OPTIONS.find(opt => opt.id === 'tomorrow')?.color;
    if (isSameDay(scheduledDate, nextWeek)) return SCHEDULE_OPTIONS.find(opt => opt.id === 'nextWeek')?.color;
    return undefined;
  };

  const ScheduleIcon = getScheduleIcon();
  const PriorityIcon = getPriorityIcon(priority);

  return (
    <>
      <div className="flex flex-col gap-4 w-[450px] pb-20">
        <div className="flex items-start justify-between -mx-4">
          <div className="flex-1">
            <div className="flex flex-col divide-y divide-light-border dark:divide-dark-border">
              {/* Title and Notes */}
              <div className="flex flex-col">
                <div className="flex items-start gap-2 px-4 py-4 border-b border-light-border dark:border-dark-border">
                  <Task className="w-5 h-5 text-light-text/50 dark:text-dark-text/50 rounded-[5px] mt-[5px]" />
                  <div className="flex-1 flex-col gap-1 px-2">
                    <input
                      ref={titleInputRef}
                      type="text"
                      placeholder="Task title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Add notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-transparent text-light-text/50 dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50"
                    />
                  </div>
                </div>

                {/* Schedule */}
                <div className="flex items-center text-light-text/50 dark:text-dark-text/50 gap-2 px-4 py-4 border-b h-[72px] border-light-border dark:border-dark-border">
                  {isEditingRecurringTask ? (
                    <div className="flex flex-col gap-1.5 opacity-50">
                      <span className="text-[11px] font-medium">Schedule</span>
                      <div className="flex items-center w-full gap-2">
                        <CalendarIcon className="w-4 h-4" />
                        <span className="text-sm">Controlled by recurrence</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Popover open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-[11px] font-medium">Schedule</span>
                          <PopoverTrigger asChild>
                            <div className="flex cursor-pointer items-center hover:text-light-text dark:hover:text-dark-text w-full gap-2">
                              <ScheduleIcon className="w-4 h-4" style={{ color: getScheduleIconColor() }} />
                              <span className="text-sm">{scheduledDate ? format(scheduledDate, 'MMM d') : 'Anytime'}</span>
                            </div>
                          </PopoverTrigger>
                        </div>
                        <PopoverContent
                          className="w-[200px] font-medium text-dark-text/50 dark:text-dark-text/50 p-1 mb-8 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg shadow-lg border border-light-border dark:border-dark-border"
                          align="start"
                        >
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            {SCHEDULE_OPTIONS.map(option => (
                              <button
                                key={option.id}
                                className={`flex items-center justify-between px-2 py-2 text-xs rounded-[5px] hover:bg-white/15 dark:hover:bg-white/5 ${
                                  (option.id === 'anytime' && !scheduledDate) ||
                                  (option.id === 'today' && scheduledDate && isToday(scheduledDate)) ||
                                  (option.id === 'tomorrow' && scheduledDate && isTomorrow(scheduledDate))
                                    ? 'text-dark-text dark:text-dark-text font-semibold'
                                    : ''
                                }`}
                                onClick={() => handleScheduleSelect(option.id)}
                              >
                                <div className="flex items-center gap-2">
                                  {option.icon && <option.icon className="w-4 h-4" style={{ color: option.color }} />}
                                  {option.label}
                                </div>
                                {((option.id === 'anytime' && !scheduledDate) ||
                                  (option.id === 'today' && scheduledDate && isToday(scheduledDate)) ||
                                  (option.id === 'tomorrow' && scheduledDate && isTomorrow(scheduledDate))) && (
                                  <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />
                                )}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                        <PopoverTrigger asChild>
                          <div className="absolute w-0 h-0 overflow-hidden" />
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-auto ml-4 mt-3 p-0 rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border shadow-lg"
                          align="start"
                        >
                          <Calendar
                            mode="single"
                            selected={scheduledDate}
                            onSelect={(date) => {
                              setScheduledDate(date);
                              setIsDatePickerOpen(false);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>

                {/* Tag */}
                <div className="flex items-center gap-2 px-4 py-4 border-b h-[72px] border-light-border dark:border-dark-border">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-light-text/50 dark:text-dark-text/50">Tag group</span>
                    <div className="flex flex-row h-[20px] items-center gap-2">
                      <Tag
                        className={`w-4 h-4 ${selectedTag ? '' : 'text-light-text/50 dark:text-dark-text/50'}`}
                        style={selectedTag ? { color: selectedTag.color } : {}}
                      />
                      <div className="relative flex-1">
                        <div className="flex items-center gap-1 py-1">
                          {selectedTag && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] text-xs"
                              style={{ backgroundColor: `${selectedTag.color}26` }}
                            >
                              {selectedTag.label}
                            </span>
                          )}
                          <input
                            type="text"
                            placeholder={selectedTag ? '' : 'Add a tag'}
                            className="flex-1 bg-transparent text-light-text dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50"
                            onFocus={() => setIsTagDropdownOpen(true)}
                            value={tagSearchText}
                            onChange={(e) => {
                              if (!e.target.value) {
                                setSelectedTag(null);
                              }
                              setTagSearchText(e.target.value);
                              setIsTagDropdownOpen(true);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && selectedTag && !tagSearchText) {
                                e.preventDefault();
                                setSelectedTag(null);
                                setPendingNewTag(null);
                                setTagSearchText('');
                              }
                              if (e.key === 'Enter' && tagSearchText && !tags.find(t => t.label.toLowerCase() === tagSearchText.toLowerCase())) {
                                e.preventDefault();
                                handleCreateTag();
                              }
                            }}
                          />
                        </div>

                        {isTagDropdownOpen && tagSearchText.length > 0 && (
                          <div className="absolute left-0 z-50 right-0 !w-[240px] max-w-[240px] p-1 top-full mt-1 bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] outline outline-1 outline-light-border dark:outline-dark-border shadow-lg overflow-hidden">
                            {tags
                              .filter(tag => tag.label.toLowerCase().includes(tagSearchText.toLowerCase()))
                              .map(tag => (
                                <button
                                  key={tag.id}
                                  className="w-full flex items-center gap-2 px-2 py-2 text-xs hover:bg-white/15 dark:hover:bg-white/5 rounded-[5px]"
                                  onClick={() => handleTagSelect(tag)}
                                >
                                  <Tag className="w-4 h-4" style={{ color: tag.color }} />
                                  <span className="text-dark-text dark:text-dark-text">{tag.label}</span>
                                </button>
                              ))}
                            {tagSearchText && !tags.find(t => t.label.toLowerCase() === tagSearchText.toLowerCase()) && (
                              <button
                                className="w-full flex items-center gap-2 px-2 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 rounded-[5px]"
                                onClick={handleCreateTag}
                              >
                                <Add className="w-4 h-4 text-dark-text/50 dark:text-dark-text/50" />
                                <span className="font-regular text-xs text-left text-dark-text/50 dark:text-dark-text/50">
                                  Create <span className="font-semibold text-dark-text dark:text-dark-text">"{tagSearchText}"</span> tag
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div className="flex items-center px-4 h-[72px] border-b border-light-border dark:border-dark-border text-light-text/50 dark:text-dark-text/50 text-sm transition-colors">
                  <Popover open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-start gap-1.5 flex-col">
                        <span className="text-[11px] font-medium">Priority</span>
                        <PopoverTrigger>
                          <div className="flex group cursor-pointer items-center gap-2">
                            <PriorityIcon
                              className={`w-4 h-4 ${priority === 'None' ? 'text-light-text/50 dark:text-dark-text/50' : ''}`}
                              style={priority === 'None' ? {} : { color: PRIORITY_OPTIONS.find(p => p.id === priority)?.color }}
                            />
                            <span className="group-hover:text-light-text dark:group-hover:text-dark-text">
                              {priority}
                            </span>
                          </div>
                        </PopoverTrigger>
                      </div>
                    </div>
                    <PopoverContent
                      className="w-[200px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50"
                      align="start"
                      side="bottom"
                    >
                      <div role="listbox" className="flex flex-col">
                        {PRIORITY_OPTIONS.map((option) => {
                          const Icon = getPriorityIcon(option.id);
                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`px-2 py-2 text-sm flex items-center justify-between rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${priority === option.id ? 'font-semibold text-dark-text dark:text-dark-text' : 'font-medium text-dark-text/50 dark:text-dark-text/50'}`}
                              onClick={() => {
                                setPriority(option.id);
                                setIsPriorityOpen(false);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Icon
                                  className={`w-4 h-4 ${option.id === 'None' ? 'text-dark-text/50 dark:text-dark-text/50' : ''}`}
                                  style={option.id === 'None' ? {} : { color: option.color }}
                                />
                                <span className="text-xs">{option.label}</span>
                              </div>
                              {priority === option.id && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Repeat */}
                <div className="flex items-center px-4 h-[72px] text-light-text/50 dark:text-dark-text/50 text-sm transition-colors">
                  <Popover open={isRepeatOpen} onOpenChange={setIsRepeatOpen}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-start flex-col gap-1.5">
                        <span className="text-[11px] font-medium">Repeat</span>
                        <PopoverTrigger>
                          <div className="flex group items-center gap-2 cursor-pointer">
                            <Repeat className="w-4 h-4" />
                            <span className="group-hover:text-light-text dark:group-hover:text-dark-text">
                              {getRepeatDisplayText(repeatOption, rruleOptions)}
                            </span>
                          </div>
                        </PopoverTrigger>
                      </div>
                    </div>
                    <PopoverContent
                      className="w-[250px] p-1 overflow-hidden bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50"
                      align="start"
                      side="top"
                    >
                      <div role="listbox" className="flex flex-col">
                        {REPEAT_OPTIONS.map((option) => {
                          let sublabel = option.sublabel;
                          const date = scheduledDate || new Date();

                          if (option.id === 'weekly' || option.id === 'biweekly') {
                            sublabel = `on ${format(date, 'EEE')}`;
                          } else if (option.id === 'monthly') {
                            sublabel = `on the ${format(date, 'do')}`;
                          } else if (option.id === 'monthlyWeekday') {
                            const dayOfMonth = date.getDate();
                            const weekNum = Math.ceil(dayOfMonth / 7);
                            const ordinal = weekNum === 1 ? '1st' : weekNum === 2 ? '2nd' : weekNum === 3 ? '3rd' : `${weekNum}th`;
                            sublabel = `on the ${ordinal} ${format(date, 'EEE')}`;
                          } else if (option.id === 'monthlyLastWeekday') {
                            sublabel = `on the last ${format(date, 'EEE')}`;
                          } else if (option.id === 'yearly') {
                            sublabel = `on ${format(date, 'MMM d')}`;
                          }

                          return (
                            <button
                              key={option.id}
                              type="button"
                              className={`px-2 py-2 text-xs flex items-center flex-row font-medium rounded-[5px] cursor-pointer hover:bg-white/15 hover:dark:bg-white/5 ${repeatOption === option.id ? 'font-semibold' : ''}`}
                              onClick={() => handleRepeatSelect(option.id)}
                            >
                              <div className="flex w-full justify-between items-center">
                                <span className={`text-xs text-dark-text/50 dark:text-dark-text/50 ${repeatOption === option.id ? 'font-semibold !text-dark-text dark:!text-dark-text' : ''}`}>
                                  {option.label}
                                </span>
                                <div className="flex items-center gap-2">
                                  {sublabel && (
                                    <span className="text-xs text-dark-text/30 font-medium dark:text-dark-text/30">{sublabel}</span>
                                  )}
                                  {repeatOption === option.id && <Check className="w-4 h-4 text-dark-text dark:text-dark-text" />}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormFooter
        activeTab="task"
        onTabChange={handleTabChange}
        onDiscard={close}
        onSave={handleSave}
        saveDisabled={!title.trim()}
        isEditing={!!editingTask?.id}
      />

      <RecurrenceModal
        isOpen={isRecurrenceModalOpen}
        onOpenChange={setIsRecurrenceModalOpen}
        initialValue={rruleOptions}
        onSave={handleSaveRecurrenceRule}
        startDate={scheduledDate || new Date()}
      />
    </>
  );
}

export default memo(TaskForm);
