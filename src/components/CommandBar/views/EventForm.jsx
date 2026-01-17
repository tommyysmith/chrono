'use client';

import { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import { format, parse, isSameDay, addDays, isBefore, isToday, isTomorrow, isYesterday, differenceInMilliseconds } from 'date-fns';
import { useCommandBar } from '../CommandBarContext';
import { Clock } from '../../../assets/icons/Clock';
import { Calendar as CalendarIcon } from '../../../assets/icons/Calendar';
import { Repeat } from '../../../assets/icons/Repeat';
import { Check } from '../../../assets/icons/Check';
import { User } from '../../../assets/icons/User';
import { Add } from '../../../assets/icons/Add';
import { Video } from '../../../assets/icons/Video';
import { Calendar } from '@/components/ui/calendar';
import { RRule, Weekday } from 'rrule';
import { TAG_COLORS } from '../../../constants/colors';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import RecurrenceModal from '../../RecurrenceModal';
import FormFooter from '../components/FormFooter';

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

const generateTimeOptions = () => {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const date = new Date();
      date.setHours(h, m);
      options.push({ value: format(date, 'HH:mm'), label: format(date, 'h:mm a') });
    }
  }
  return options;
};

const ALL_TIME_OPTIONS = generateTimeOptions();

const parseTimeString = (timeStr) => {
  if (!timeStr) return null;
  const formats = ['h:mm a', 'ha', 'h a', 'HH:mm', 'H:mm', 'H'];
  for (const fmt of formats) {
    const parsed = parse(timeStr, fmt, new Date());
    if (!isNaN(parsed)) return format(parsed, 'HH:mm');
  }
  return null;
};

const getDefaultEventColor = () => typeof window !== 'undefined' ? localStorage.getItem('defaultEventColor') || '#F59E0B' : '#F59E0B';

const roundToNearest15Min = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const remainder = minutes % 15;
  const roundedMinutes = remainder < 8 ? minutes - remainder : minutes + (15 - remainder);
  const newHours = Math.floor((hours * 60 + roundedMinutes) / 60) % 24;
  return `${String(newHours).padStart(2, '0')}:${String(roundedMinutes % 60).padStart(2, '0')}`;
};

const ensureMinimumGap = (startTime, endTime) => {
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  if (eH * 60 + eM <= sH * 60 + sM + 14) {
    const newEnd = sH * 60 + sM + 15;
    return `${String(Math.floor(newEnd / 60) % 24).padStart(2, '0')}:${String(newEnd % 60).padStart(2, '0')}`;
  }
  return endTime;
};

const formatTimeToNatural = (timeStr) => {
  if (!timeStr) return '';
  const [hours] = timeStr.split(':').map(Number);
  if (hours >= 5 && hours < 12) return 'Morning';
  if (hours >= 12 && hours < 17) return 'Afternoon';
  if (hours >= 17 && hours < 21) return 'Evening';
  return 'Night';
};

const formatDateToNatural = (dateStr) => {
  if (!dateStr) return 'Invalid date';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Invalid date';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEEE, MMMM d');
};

const getRepeatDisplayText = (repeatValue, rruleOptions) => {
  if (repeatValue === 'custom' && rruleOptions) {
    try {
      const opts = { ...rruleOptions };
      if (opts.dtstart) opts.dtstart = new Date(opts.dtstart);
      if (opts.byweekday) opts.byweekday = opts.byweekday.map(d => d instanceof Weekday ? d : typeof d === 'number' ? new Weekday(d) : d.weekday !== undefined ? new Weekday(d.weekday) : RRule[d]);
      return new RRule(opts).toText();
    } catch { return 'Custom'; }
  }
  return REPEAT_OPTIONS.find(o => o.id === repeatValue)?.label || 'Does not repeat';
};

function EventForm({ onCreateEvent, onUpdateEvent, setRepeatEditModalState }) {
  const { editingEvent, close, openTaskForm } = useCommandBar();
  const titleInputRef = useRef(null);
  const originalEventRef = useRef(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [color, setColor] = useState(getDefaultEventColor());
  const [repeatOption, setRepeatOption] = useState('none');
  const [rruleOptions, setRruleOptions] = useState(null);
  const [seriesId, setSeriesId] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [organizer, setOrganizer] = useState(null);
  const [hangoutLink, setHangoutLink] = useState(null);
  const [preservedStartTime, setPreservedStartTime] = useState('09:00');
  const [preservedEndTime, setPreservedEndTime] = useState('10:00');
  const [hasChanges, setHasChanges] = useState(false);

  // UI state
  const [isRepeatOpen, setIsRepeatOpen] = useState(false);
  const [isStartTimeOpen, setIsStartTimeOpen] = useState(false);
  const [isEndTimeOpen, setIsEndTimeOpen] = useState(false);
  const [startTimeSearch, setStartTimeSearch] = useState('');
  const [endTimeSearch, setEndTimeSearch] = useState('');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [attendeeSearchText, setAttendeeSearchText] = useState('');
  const [isAttendeePopoverOpen, setIsAttendeePopoverOpen] = useState(false);
  const [recentContacts, setRecentContacts] = useState([]);

  // Load recent contacts from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('recentContacts');
      if (stored) setRecentContacts(JSON.parse(stored));
    } catch (e) { console.error('Failed to load recent contacts:', e); }
  }, []);

  // Email validation
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Filter suggestions based on search
  const filteredAttendeeSuggestions = useMemo(() => {
    if (!attendeeSearchText) return recentContacts.filter(c => !attendees.some(a => a.email === c.email));
    return recentContacts.filter(c => 
      !attendees.some(a => a.email === c.email) &&
      (c.email.toLowerCase().includes(attendeeSearchText.toLowerCase()) ||
       (c.displayName && c.displayName.toLowerCase().includes(attendeeSearchText.toLowerCase())))
    );
  }, [attendeeSearchText, recentContacts, attendees]);

  // Add attendee handler
  const handleAddAttendee = useCallback((contact) => {
    if (!contact?.email || attendees.some(a => a.email === contact.email)) return;
    setAttendees(prev => [...prev, { email: contact.email, displayName: contact.displayName || null, responseStatus: 'needsAction' }]);
    setAttendeeSearchText('');
    setIsAttendeePopoverOpen(false);
    // Save to recent contacts
    const updated = [contact, ...recentContacts.filter(c => c.email !== contact.email)].slice(0, 10);
    setRecentContacts(updated);
    try { localStorage.setItem('recentContacts', JSON.stringify(updated)); } catch (e) {}
    setHasChanges(true);
  }, [attendees, recentContacts]);

  // Remove attendee handler
  const handleRemoveAttendee = useCallback((email) => {
    setAttendees(prev => prev.filter(a => a.email !== email));
    setHasChanges(true);
  }, []);

  // Initialize form
  useEffect(() => {
    if (editingEvent) {
      originalEventRef.current = editingEvent;
      setTitle(editingEvent.title || '');
      setDescription(editingEvent.description || '');
      setDate(format(new Date(editingEvent.start), 'yyyy-MM-dd'));
      setEndDate(format(new Date(editingEvent.end), 'yyyy-MM-dd'));
      setStartTime(format(new Date(editingEvent.start), 'HH:mm'));
      setEndTime(format(new Date(editingEvent.end), 'HH:mm'));
      setIsAllDay(editingEvent.allDay || editingEvent.isAllDay || false);
      setIsMultiDay(!isSameDay(new Date(editingEvent.start), new Date(editingEvent.end)));
      setColor(editingEvent.color || getDefaultEventColor());
      setRepeatOption(editingEvent.repeat || 'none');
      setRruleOptions(editingEvent.rruleOptions || null);
      setSeriesId(editingEvent.seriesId || null);
      setAttendees(editingEvent.attendees || []);
      setOrganizer(editingEvent.organizer || null);
      setHangoutLink(editingEvent.hangoutLink || null);
      setPreservedStartTime(format(new Date(editingEvent.start), 'HH:mm'));
      setPreservedEndTime(format(new Date(editingEvent.end), 'HH:mm'));
      setHasChanges(false);
    } else {
      originalEventRef.current = null;
      const now = new Date();
      const rounded = roundToNearest15Min(format(now, 'HH:mm'));
      setTitle(''); setDescription('');
      setDate(format(now, 'yyyy-MM-dd')); setEndDate(format(now, 'yyyy-MM-dd'));
      setStartTime(rounded); setEndTime(format(new Date(now.getTime() + 3600000), 'HH:mm'));
      setIsAllDay(false); setIsMultiDay(false);
      setColor(getDefaultEventColor()); setRepeatOption('none'); setRruleOptions(null); setSeriesId(null);
      setAttendees([]); setOrganizer(null); setHangoutLink(null);
      setPreservedStartTime(rounded); setPreservedEndTime(format(new Date(now.getTime() + 3600000), 'HH:mm'));
      setHasChanges(false);
    }
  }, [editingEvent]);

  useEffect(() => { setTimeout(() => titleInputRef.current?.focus(), 50); }, []);

  // Listen for ESC key discard event from CommandBar
  useEffect(() => {
    const handleDiscardEvent = () => {
      console.log('[EventForm] Received commandbar-discard event');
      if (editingEvent?.isDraft) {
        console.log('[EventForm] Deleting draft event via ESC with ID:', editingEvent.id);
        onUpdateEvent?.({ ...editingEvent, _shouldDelete: true });
      }
      close();
    };
    
    window.addEventListener('commandbar-discard', handleDiscardEvent);
    return () => window.removeEventListener('commandbar-discard', handleDiscardEvent);
  }, [editingEvent, onUpdateEvent, close]);

  useEffect(() => {
    if (!originalEventRef.current) { setHasChanges(true); return; }
    const o = originalEventRef.current;
    setHasChanges(title !== (o.title || '') || description !== (o.description || '') ||
      date !== format(new Date(o.start), 'yyyy-MM-dd') || startTime !== format(new Date(o.start), 'HH:mm') ||
      endTime !== format(new Date(o.end), 'HH:mm') || isAllDay !== (o.allDay || o.isAllDay || false) ||
      color !== (o.color || getDefaultEventColor()) || repeatOption !== (o.repeat || 'none'));
  }, [title, description, date, startTime, endTime, isAllDay, color, repeatOption]);

  const createLocalDateTime = useCallback((dateStr, timeStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = timeStr.split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
  }, []);

  const createLocalDate = useCallback((dateStr, h = 0, m = 0) => {
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d, h, m);
  }, []);

  const filteredStartTimeOptions = useMemo(() => {
    if (!startTimeSearch) return ALL_TIME_OPTIONS;
    const l = startTimeSearch.toLowerCase();
    return ALL_TIME_OPTIONS.filter(({ label }) => label.toLowerCase().includes(l));
  }, [startTimeSearch]);

  const filteredEndTimeOptions = useMemo(() => {
    const [sH, sM] = startTime.split(':').map(Number);
    const sTotal = sH * 60 + sM;
    let f = ALL_TIME_OPTIONS.filter(({ value }) => { const [h, m] = value.split(':').map(Number); return h * 60 + m >= sTotal + 15; });
    if (endTimeSearch) { const l = endTimeSearch.toLowerCase(); f = f.filter(({ label }) => label.toLowerCase().includes(l)); }
    return f;
  }, [endTimeSearch, startTime]);

  const handleStartTimeChange = useCallback((newStart) => {
    const base = new Date();
    const cS = parse(startTime, 'HH:mm', base), cE = parse(endTime, 'HH:mm', base), nS = parse(newStart, 'HH:mm', base);
    if (!isNaN(cS) && !isNaN(cE) && !isNaN(nS)) {
      const dur = Math.max(differenceInMilliseconds(cE, cS), 900000);
      const nE = new Date(nS.getTime() + dur);
      setStartTime(newStart); setEndTime(format(nE, 'HH:mm'));
      setPreservedStartTime(newStart); setPreservedEndTime(format(nE, 'HH:mm'));
    } else setStartTime(newStart);
  }, [startTime, endTime]);

  const handleEndTimeChange = useCallback((newEnd) => {
    const adj = ensureMinimumGap(startTime, newEnd);
    setEndTime(adj); setPreservedEndTime(adj);
  }, [startTime]);

  const handleAllDayToggle = useCallback((checked) => {
    if (checked) { setPreservedStartTime(startTime); setPreservedEndTime(endTime); setIsAllDay(true); }
    else { setStartTime(preservedStartTime); setEndTime(preservedEndTime); setIsAllDay(false); }
  }, [startTime, endTime, preservedStartTime, preservedEndTime]);

  const handleMultiDayToggle = useCallback((checked) => {
    if (checked) {
      const sD = parse(date, 'yyyy-MM-dd', new Date()), eD = parse(endDate, 'yyyy-MM-dd', new Date());
      if (isSameDay(sD, eD) || isBefore(eD, sD)) setEndDate(format(addDays(sD, 1), 'yyyy-MM-dd'));
      setIsMultiDay(true);
    } else { setEndDate(date); setIsMultiDay(false); }
  }, [date, endDate]);

  const handleDateChange = useCallback((newDate) => {
    setDate(newDate);
    if (!isMultiDay) setEndDate(newDate);
    else {
      const sD = parse(newDate, 'yyyy-MM-dd', new Date()), eD = parse(endDate, 'yyyy-MM-dd', new Date());
      if (isSameDay(sD, eD)) setIsMultiDay(false);
      else if (isBefore(eD, sD)) setEndDate(format(addDays(sD, 1), 'yyyy-MM-dd'));
    }
  }, [isMultiDay, endDate]);

  const handleEndDateChange = useCallback((newEnd) => {
    const sD = parse(date, 'yyyy-MM-dd', new Date()), eD = parse(newEnd, 'yyyy-MM-dd', new Date());
    if (isSameDay(sD, eD)) setIsMultiDay(false);
    else if (isBefore(eD, sD)) setEndDate(format(addDays(sD, 1), 'yyyy-MM-dd'));
    else { setEndDate(newEnd); setIsMultiDay(true); }
  }, [date]);

  const handleRepeatSelect = useCallback((id) => {
    if (id === 'custom') { setIsRecurrenceModalOpen(true); setIsRepeatOpen(false); }
    else { setRepeatOption(id); setRruleOptions(null); setIsRepeatOpen(false); }
  }, []);

  const handleSaveRecurrenceRule = useCallback((opts) => {
    setRepeatOption('custom'); setRruleOptions(opts); setIsRecurrenceModalOpen(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!title.trim()) return;
    const eventData = {
      id: editingEvent?.id, title: title.trim(), description,
      start: (isAllDay || isMultiDay) ? createLocalDate(date, 0, 0) : createLocalDateTime(date, startTime),
      end: isMultiDay ? createLocalDate(endDate, 23, 59) : (isAllDay ? createLocalDate(date, 23, 59) : createLocalDateTime(date, endTime)),
      allDay: isAllDay || isMultiDay, isAllDay: isAllDay || isMultiDay, isMultiDay,
      repeat: repeatOption, rruleOptions, seriesId, color,
      isRepeat: editingEvent?.isRepeat || false,
      _editScope: editingEvent?._editScope || 'single',
      _seriesUpdate: editingEvent?._seriesUpdate || false,
      _originalSeriesId: editingEvent?._originalSeriesId || editingEvent?.seriesId,
      _originalEvent: editingEvent?._originalEvent || editingEvent,
      _exactPosition: {
        start: (isAllDay || isMultiDay) ? createLocalDate(date, 0, 0) : createLocalDateTime(date, startTime),
        end: isMultiDay ? createLocalDate(endDate, 23, 59) : (isAllDay ? createLocalDate(date, 23, 59) : createLocalDateTime(date, endTime))
      },
      isDraft: false, attendees, organizer, hangoutLink,
      source: editingEvent?.source || 'local',
      externalId: editingEvent?.externalId, externalCalendarId: editingEvent?.externalCalendarId,
    };

    const isRecurring = editingEvent?.seriesId || (editingEvent?.repeat && editingEvent?.repeat !== 'none') || editingEvent?.rruleOptions || editingEvent?.isRepeat;

    if (editingEvent?.isDraft) {
      onCreateEvent?.(eventData);
      onUpdateEvent?.({ ...editingEvent, _shouldDelete: true });
      close();
    } else if (editingEvent?.id && isRecurring && setRepeatEditModalState) {
      setRepeatEditModalState({
        isOpen: true, event: eventData, draggedEvent: eventData,
        originalEvent: { ...editingEvent, start: new Date(editingEvent.start), end: new Date(editingEvent.end) },
        isEditOperation: true,
      });
      close();
    } else if (editingEvent?.id) { onUpdateEvent?.(eventData); close(); }
    else { onCreateEvent?.(eventData); close(); }
  }, [title, description, date, endDate, startTime, endTime, isAllDay, isMultiDay, color, repeatOption, rruleOptions, seriesId, attendees, organizer, hangoutLink, editingEvent, onCreateEvent, onUpdateEvent, setRepeatEditModalState, close, createLocalDateTime, createLocalDate]);

  const handleTabChange = useCallback((tab) => { if (tab === 'task') openTaskForm(); }, [openTaskForm]);

  const handleDiscard = useCallback(() => {
    console.log('[EventForm] handleDiscard called, editingEvent:', editingEvent);
    if (editingEvent?.isDraft) {
      console.log('[EventForm] Deleting draft event with ID:', editingEvent.id);
      onUpdateEvent?.({ ...editingEvent, _shouldDelete: true });
    }
    close();
  }, [editingEvent, onUpdateEvent, close]);

  return (
    <>
      <div className="flex flex-col gap-4 w-[550px] pb-20">
        <div className="flex flex-col -mx-4">
          {/* Title with Color */}
          <div className="flex px-4 py-4 flex-row border-b border-dashed border-light-border dark:border-dark-border">
            <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
              <PopoverTrigger asChild>
                <div className="w-4 h-4 mt-1.5 rounded-md cursor-pointer hover:ring-1 hover:ring-offset-2 transition-all" style={{ backgroundColor: color }} />
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-[9px] bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border p-3">
                <div className="grid grid-cols-5 gap-2">
                  {TAG_COLORS.map((c) => (
                    <div key={c} className="w-5 h-5 rounded-[5px] cursor-pointer hover:ring-1 transition-all" style={{ backgroundColor: c }} onClick={() => { setColor(c); setColorPickerOpen(false); }} />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <div className="flex flex-col gap-1 px-4 flex-1">
              <input ref={titleInputRef} type="text" placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-transparent text-light-text dark:text-dark-text placeholder-light-text/50 dark:placeholder-dark-text/50 text-lg font-medium outline-none" />
              <input type="text" placeholder="Add description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-transparent text-light-text/50 dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50" />
            </div>
            <Popover open={isRepeatOpen} onOpenChange={setIsRepeatOpen}>
              <PopoverTrigger className="flex items-center gap-2 h-[32px] cursor-pointer rounded-md focus:outline-none px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <Repeat className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                <span className={`text-sm font-medium ${repeatOption === 'none' ? 'text-light-text/50 dark:text-dark-text/50' : 'text-light-text dark:text-dark-text'}`}>
                  {repeatOption === 'none' ? 'Repeat' : getRepeatDisplayText(repeatOption, rruleOptions)}
                </span>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-1 bg-dark-bg-lighter dark:bg-dark-bg-light border border-light-border dark:border-dark-border rounded-[9px] shadow-md z-50" align="end" side="bottom">
                <div className="flex flex-col">
                  {REPEAT_OPTIONS.map((opt) => {
                    let sub = opt.sublabel;
                    const d = parse(date, 'yyyy-MM-dd', new Date());
                    if (opt.id === 'weekly' || opt.id === 'biweekly') sub = `on ${format(d, 'EEE')}`;
                    else if (opt.id === 'monthly') sub = `on the ${format(d, 'do')}`;
                    else if (opt.id === 'monthlyWeekday') { const w = Math.ceil(d.getDate() / 7); sub = `on the ${w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : `${w}th`} ${format(d, 'EEE')}`; }
                    else if (opt.id === 'monthlyLastWeekday') sub = `on the last ${format(d, 'EEE')}`;
                    else if (opt.id === 'yearly') sub = `on ${format(d, 'MMM d')}`;
                    return (
                      <button key={opt.id} className={`px-2 py-2 text-xs flex items-center font-medium rounded-[5px] cursor-pointer hover:bg-white/15 dark:hover:bg-white/5 ${repeatOption === opt.id ? 'font-semibold' : ''}`} onClick={() => handleRepeatSelect(opt.id)}>
                        <div className="flex w-full justify-between items-center">
                          <span className={`text-xs text-dark-text/50 ${repeatOption === opt.id ? 'font-semibold !text-dark-text' : ''}`}>{opt.label}</span>
                          <div className="flex items-center gap-2">
                            {sub && <span className="text-xs text-dark-text/30">{sub}</span>}
                            {repeatOption === opt.id && <Check className="w-4 h-4 text-dark-text" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Time and Date */}
          <div className="flex flex-row">
            <div className={`flex items-top gap-2 px-4 py-4 flex-1 ${(isMultiDay || isAllDay) ? 'opacity-50' : ''}`}>
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-light-text/50 dark:text-dark-text/50">Time</span>
                <div className="flex items-start gap-2">
                  <Clock className={`w-4 h-4 ${(isMultiDay || isAllDay) ? 'text-light-text/30 dark:text-dark-text/30' : 'text-light-text/50 dark:text-dark-text/50'}`} />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 h-[16px]">
                      <Popover open={!(isMultiDay || isAllDay) && isStartTimeOpen} onOpenChange={setIsStartTimeOpen}>
                        <PopoverTrigger asChild>
                          <input type="text" value={startTimeSearch || format(parse(startTime, 'HH:mm', new Date()), 'h:mm a')} disabled={isMultiDay || isAllDay} onFocus={(e) => { if (!(isMultiDay || isAllDay)) { setTimeout(() => e.target.select(), 0); setStartTimeSearch(''); } }} onChange={(e) => { if (!(isMultiDay || isAllDay)) { setStartTimeSearch(e.target.value); const p = parseTimeString(e.target.value); if (p) handleStartTimeChange(p); } }} className={`text-sm bg-transparent border-none w-[64px] p-0 focus:ring-0 focus:outline-none inline-block shrink-0 ${(isMultiDay || isAllDay) ? 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed' : 'text-light-text dark:text-dark-text cursor-pointer'}`} />
                        </PopoverTrigger>
                        <PopoverContent className="w-[160px] max-h-[200px] overflow-auto p-1 bg-dark-bg-lighter border border-light-border rounded-[9px] shadow-md z-50" align="start" side="top" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <div className="flex flex-col">
                            {filteredStartTimeOptions.map((o) => (<button key={o.value} className={`flex items-center justify-between px-2 py-1.5 text-xs font-medium rounded-[5px] cursor-pointer hover:bg-white/15 ${startTime === o.value ? 'font-semibold text-dark-text' : 'text-dark-text/50'}`} onClick={() => { handleStartTimeChange(o.value); setIsStartTimeOpen(false); setStartTimeSearch(''); }}><span>{o.label}</span>{startTime === o.value && <Check className="w-4 h-4" />}</button>))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <span className={`${(isMultiDay || isAllDay) ? 'text-light-text/30 dark:text-dark-text/30' : 'text-light-text/50 dark:text-dark-text/50'}`}>→</span>
                      <Popover open={!(isMultiDay || isAllDay) && isEndTimeOpen} onOpenChange={setIsEndTimeOpen}>
                        <PopoverTrigger asChild>
                          <input type="text" value={endTimeSearch || format(parse(endTime, 'HH:mm', new Date()), 'h:mm a')} disabled={isMultiDay || isAllDay} onFocus={(e) => { if (!(isMultiDay || isAllDay)) { setTimeout(() => e.target.select(), 0); setEndTimeSearch(''); } }} onChange={(e) => { if (!(isMultiDay || isAllDay)) { setEndTimeSearch(e.target.value); const p = parseTimeString(e.target.value); if (p) handleEndTimeChange(p); } }} className={`text-sm bg-transparent border-none w-[64px] p-0 focus:ring-0 focus:outline-none inline-block shrink-0 ${(isMultiDay || isAllDay) ? 'text-light-text/30 dark:text-dark-text/30 cursor-not-allowed' : 'text-light-text dark:text-dark-text cursor-pointer'}`} />
                        </PopoverTrigger>
                        <PopoverContent className="w-[160px] max-h-[200px] overflow-y-auto p-1 bg-dark-bg-lighter border border-light-border rounded-[9px] shadow-md z-50" align="start" side="top" onOpenAutoFocus={(e) => e.preventDefault()}>
                          <div className="flex flex-col">
                            {filteredEndTimeOptions.map((o) => { const [sH, sM] = startTime.split(':').map(Number); const [eH, eM] = o.value.split(':').map(Number); const diff = (eH * 60 + eM) - (sH * 60 + sM); const dur = diff >= 60 ? `${Math.floor(diff / 60)}h${diff % 60 > 0 ? ` ${diff % 60}m` : ''}` : `${diff}m`; return (<button key={o.value} className={`flex justify-between items-center px-2 py-1.5 text-xs font-medium rounded-[5px] cursor-pointer hover:bg-white/15 ${endTime === o.value ? 'bg-white/15 font-semibold text-dark-text' : 'text-dark-text/50'}`} onClick={() => { handleEndTimeChange(o.value); setIsEndTimeOpen(false); setEndTimeSearch(''); }}><span>{o.label}</span><div className="flex items-center gap-2"><span className="text-xs text-dark-text/30">({dur})</span>{endTime === o.value && <Check className="w-4 h-4" />}</div></button>); })}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center h-[24px] gap-1"><span className="text-sm text-light-text/50 dark:text-dark-text/50">{formatTimeToNatural(startTime)}</span></div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={isAllDay} onChange={(e) => handleAllDayToggle(e.target.checked)} /><div className="w-7 h-4 bg-light-text/30 dark:bg-dark-text/50 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:shadow-sm after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500" /></label>
                      <span className="text-xs text-light-text/50 dark:text-dark-text/50">All day</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-top gap-2 px-4 py-4 flex-1 border-l border-dashed border-light-border dark:border-dark-border">
              <div className="flex flex-col gap-2">
                <span className="text-[11px] text-light-text/50 dark:text-dark-text/50">Date</span>
                <div className="flex flex-row gap-2">
                  <CalendarIcon className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center h-[16px] gap-2">
                      <Popover><PopoverTrigger asChild><span className="text-sm text-light-text dark:text-dark-text cursor-pointer">{format(parse(date, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}</span></PopoverTrigger><PopoverContent className="w-auto p-0 bg-dark-bg-lighter border border-light-border rounded-lg shadow-lg"><Calendar mode="single" selected={new Date(date)} onSelect={(d) => d && handleDateChange(format(d, 'yyyy-MM-dd'))} initialFocus /></PopoverContent></Popover>
                      {isMultiDay && (<><span className="text-light-text/50">→</span><Popover><PopoverTrigger asChild><span className="text-sm text-light-text dark:text-dark-text cursor-pointer">{format(parse(endDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy')}</span></PopoverTrigger><PopoverContent className="w-auto p-0 bg-dark-bg-lighter border border-light-border rounded-lg shadow-lg"><Calendar mode="single" selected={new Date(endDate)} onSelect={(d) => d && handleEndDateChange(format(d, 'yyyy-MM-dd'))} initialFocus /></PopoverContent></Popover></>)}
                    </div>
                    <div className="flex items-center h-[24px]"><span className="text-sm text-light-text/50 dark:text-dark-text/50">{formatDateToNatural(date)}</span>{isMultiDay && <><span className="text-light-text/50 dark:text-dark-text/50 mx-1">-</span><span className="text-sm text-light-text/50 dark:text-dark-text/50">{formatDateToNatural(endDate)}</span></>}</div>
                    <div className="flex items-center h-[24px] gap-2">
                      <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={isMultiDay} onChange={(e) => handleMultiDayToggle(e.target.checked)} /><div className="w-7 h-4 bg-light-text/30 dark:bg-dark-text/50 peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:shadow-sm after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-500" /></label>
                      <span className="text-xs text-light-text/50 dark:text-dark-text/50">Multi-day</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Participants & Join Call Section */}
          {(attendees.length > 0 || hangoutLink) && (
            <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-dashed border-light-border dark:border-dark-border">
              {/* Participants with popover */}
              {attendees.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <div className="flex items-center gap-2 cursor-pointer group">
                      <User className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                      <div className="flex -space-x-2">
                        {attendees.slice(0, 3).map((a, i) => (
                          <div 
                            key={i} 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white ring-2 ring-light-bg dark:ring-dark-bg-lighter"
                            style={{ 
                              backgroundColor: a.organizer ? '#22C55E' : ['#3B82F6', '#A855F7', '#EF4444', '#F59E0B', '#10B981'][i % 5],
                              zIndex: 10 - i 
                            }}
                          >
                            {(a.displayName || a.email || '?').charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {attendees.length > 3 && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-light-text dark:text-dark-text bg-light-bg-lighter dark:bg-dark-bg ring-2 ring-light-bg dark:ring-dark-bg-lighter" style={{ zIndex: 6 }}>
                            +{attendees.length - 3}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-light-text/70 dark:text-dark-text/70 group-hover:text-light-text dark:group-hover:text-dark-text">
                        {attendees.length} participant{attendees.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[280px] p-2 bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[9px] shadow-lg" align="start" side="top">
                    <div className="flex flex-col gap-2">
                      <span className="text-[11px] font-medium text-white/50 dark:text-dark-text/50 px-1">Participants</span>
                      {attendees.map((a, i) => (
                        <div key={i} className="group flex items-center gap-2 px-1 py-1 rounded-md hover:bg-white/5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: a.organizer ? '#22C55E' : ['#3B82F6', '#A855F7', '#EF4444', '#F59E0B', '#10B981'][i % 5] }}>
                            {(a.displayName || a.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm text-white dark:text-dark-text truncate">{a.displayName || a.email}</span>
                            {a.organizer && <span className="text-[10px] text-white/50 dark:text-dark-text/50">Organizer</span>}
                          </div>
                          {a.responseStatus && (
                            <div className="shrink-0 group-hover:hidden">
                              {a.responseStatus === 'accepted' && <Check className="w-3.5 h-3.5 text-green-500" />}
                              {a.responseStatus === 'declined' && <span className="text-[10px] text-red-500">Declined</span>}
                              {a.responseStatus === 'tentative' && <span className="text-[10px] text-yellow-500">Maybe</span>}
                              {a.responseStatus === 'needsAction' && <span className="text-[10px] text-white/40 dark:text-dark-text/40">Pending</span>}
                            </div>
                          )}
                          {/* Remove button - shown on hover, only for non-organizers */}
                          {!a.organizer && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveAttendee(a.email); }}
                              className="hidden group-hover:flex shrink-0 w-6 h-6 items-center justify-center rounded-md hover:bg-red-500/20 text-white/50 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Join Call Button */}
              {hangoutLink && (
                <div className="flex items-center gap-2 shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <a href={hangoutLink} target="_blank" rel="noopener noreferrer" className="flex group items-center gap-[2px] px-2 h-[28px] rounded-[8px] border border-green-500/30 hover:bg-green-400 bg-green-500/10">
                    <Video className="w-4 h-4 text-green-600 dark:text-green-400 group-hover:text-white dark:group-hover:text-white" />
                    <span className="px-1 text-[14px] font-semibold text-green-600 dark:text-green-400 group-hover:text-white dark:group-hover:text-inverse">Join</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Add Participant Input Section */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-light-border dark:border-dark-border">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[11px] font-medium text-light-text/50 dark:text-dark-text/50">Add participant</span>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter email address"
                    value={attendeeSearchText}
                    onChange={(e) => {
                      setAttendeeSearchText(e.target.value);
                      setIsAttendeePopoverOpen(true);
                    }}
                    onFocus={() => setIsAttendeePopoverOpen(true)}
                    onBlur={(e) => {
                      // Only close if not clicking inside the popover
                      if (!e.relatedTarget?.closest('[data-radix-popper-content-wrapper]')) {
                        setTimeout(() => setIsAttendeePopoverOpen(false), 150);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && attendeeSearchText) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (isValidEmail(attendeeSearchText)) handleAddAttendee({ email: attendeeSearchText });
                      }
                      if (e.key === 'Escape') {
                        setIsAttendeePopoverOpen(false);
                      }
                    }}
                    className="w-full bg-transparent text-light-text dark:text-dark-text text-sm outline-none placeholder-light-text/50 dark:placeholder-dark-text/50"
                  />
                  <Popover open={isAttendeePopoverOpen} onOpenChange={setIsAttendeePopoverOpen}>
                    <PopoverTrigger asChild>
                      <div className="absolute inset-0 pointer-events-none" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-1 bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[9px] shadow-lg" align="start" side="top" sideOffset={8} onOpenAutoFocus={(e) => e.preventDefault()}>
                      <div className="flex flex-col">
                        {/* Add email option */}
                        {attendeeSearchText && isValidEmail(attendeeSearchText) && (
                          <button type="button" className="flex items-center gap-2 px-2 py-2 text-sm rounded-[5px] hover:bg-white/15 dark:hover:bg-white/5" onClick={() => handleAddAttendee({ email: attendeeSearchText })}>
                            <Add className="w-4 h-4 text-primary" />
                            <span className="text-xs text-light-text dark:text-dark-text">Add "{attendeeSearchText}"</span>
                          </button>
                        )}
                        
                        {/* Recent contacts / suggestions */}
                        {filteredAttendeeSuggestions.length > 0 && (
                          <>
                            {(attendeeSearchText && isValidEmail(attendeeSearchText)) && <div className="h-[1px] bg-light-border dark:bg-dark-border my-1" />}
                            <span className="text-[10px] font-medium text-light-text/40 dark:text-dark-text/40 px-2 py-1">
                              {attendeeSearchText ? 'Suggestions' : 'Recent'}
                            </span>
                            {filteredAttendeeSuggestions.map((contact, index) => (
                              <button key={`contact-${contact.email}-${index}`} type="button" className="flex items-center gap-2 px-2 py-2 text-sm rounded-[5px] hover:bg-white/15 dark:hover:bg-white/5" onClick={() => handleAddAttendee(contact)}>
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0" style={{ backgroundColor: ['#3B82F6', '#A855F7', '#EF4444', '#F59E0B', '#10B981'][index % 5] }}>
                                  {(contact.displayName || contact.email || '?').charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col items-start min-w-0 flex-1">
                                  <span className="text-xs text-light-text dark:text-dark-text truncate w-full text-left">{contact.displayName || contact.email.split('@')[0]}</span>
                                  <span className="text-[10px] text-light-text/50 dark:text-dark-text/50 truncate w-full text-left">{contact.email}</span>
                                </div>
                              </button>
                            ))}
                          </>
                        )}
                        
                        {/* Empty state */}
                        {!attendeeSearchText && filteredAttendeeSuggestions.length === 0 && (
                          <div className="px-2 py-3 text-center">
                            <span className="text-xs text-light-text/50 dark:text-dark-text/50">Type an email address to invite</span>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FormFooter activeTab="event" onTabChange={handleTabChange} onDiscard={handleDiscard} onSave={handleSave} saveDisabled={!title.trim() || (!hasChanges && !editingEvent?.isDraft)} isEditing={!!editingEvent?.id && !editingEvent?.isDraft} />
      <RecurrenceModal isOpen={isRecurrenceModalOpen} onOpenChange={setIsRecurrenceModalOpen} initialValue={rruleOptions} onSave={handleSaveRecurrenceRule} startDate={(isAllDay || isMultiDay) ? createLocalDate(date, 0, 0) : createLocalDateTime(date, startTime)} />
    </>
  );
}

export default memo(EventForm);
