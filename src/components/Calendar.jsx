"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { addDays } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import DeleteEventModal from "./DeleteEventModal";
import RepeatEditModal from "./RepeatEditModal";
import CommandBar from "./CommandBar";
import GoToDateCommand from "./GoToDateCommand";
import Day from "./views/Day";
import Week from "./views/Week";
import Month from "./views/Month";
import { generateEventId } from "../utils/eventUtils";
import {
  handlePrevious,
  handleNext,
  handleToday,
} from "@/hooks/navHandlers.js";
import { useEventManagement } from "@/hooks/useEventManagement.js";
import { useCalendarInteractions } from "@/hooks/useCalendarInteractions.js";
import { useContextMenu } from "@/hooks/useContextMenu.js";
import { useDragAndDrop } from "@/hooks/useDragAndDrop.js";
import { useEventRendering } from "@/hooks/useEventRendering.js";
import { useModalManagement } from "@/hooks/useModalManagement.js";
import { useTaskManagement } from "@/hooks/useTaskManagement.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import {
  getTimeFromMousePosition,
  getColumnFromMousePosition,
} from "@/utils/positionUtils.js";

import { TAG_COLORS } from "../constants/colors";
import { Trash } from "@/assets/icons/Trash";
import { Copy } from "@/assets/icons/Copy";
import { SidebarIcon } from "@/assets/icons/Sidebar";

const ViewType = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
};

export default function Calendar({ selectedDate = new Date(), onDateSelect }) {
  const [viewType, setViewType] = useState(ViewType.WEEK);
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const colors = TAG_COLORS;
  const commandBarRef = useRef(null);
  const timeGridRef = useRef(null);

  const {
    events,
    setEvents,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleDeleteSeriesEvents,
  } = useEventManagement(commandBarRef);

  // We no longer need virtualized events - use real events directly
  const displayEvents = events;

  const {
    deleteModalState,
    setDeleteModalState,
    repeatEditModalState,
    setRepeatEditModalState,
    isGoToDateOpen,
    setIsGoToDateOpen,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    viewDropdownRef,
    handleDeleteConfirm,
    handleDeleteModalClose,
    handleRepeatEditConfirm,
    handleRepeatEditDiscard,
  } = useModalManagement(setEvents, commandBarRef, handleUpdateEvent, handleDeleteSeriesEvents);

  const {
    setClickState,
    pendingEventCell,
    setPendingEventCell,
    handleCellClick,
    handleEventClick,
    handleCommandBarClose,
  } = useCalendarInteractions(commandBarRef, setRepeatEditModalState);

  const {
    contextMenu,
    setContextMenu,
    contextMenuRef,
    handleEventContextMenu,
    handleColorSelect,
    handleEventDelete,
    handleEventDuplicate,
  } = useContextMenu(events, setEvents, handleDeleteEvent, setDeleteModalState);

  const {
    dragState,
    setDragState,
    handleDragStart,
    handleCellDragStart,
    handleResizeStart,
  } = useDragAndDrop({
    events,
    setEvents,
    selectedDate,
    viewType,
    currentDate,
    commandBarRef,
    setRepeatEditModalState,
    setClickState,
    colors,
    handleUpdateEvent,
  });

  const eventStyleGetter = useCallback((event, start, end, isSelected) => {
    const style = {
      backgroundColor: event.color || '#808080',
      borderRadius: '4px',
      opacity: 1,
      color: '#fff',
      border: 'none',
      display: 'block'
    };

    // Add preview styling
    if (event._isPreview) {
      style.border = '2px dashed #fff';
      style.opacity = 0.8;
      style.boxShadow = '0 0 8px rgba(0,0,0,0.2)';
    }

    return {
      style
    };
  }, []);

  const { renderEvents, renderAllDayEvents } = useEventRendering(
    displayEvents,
    selectedDate,
    viewType,
    dragState,
    handleDragStart,
    handleEventClick,
    handleEventContextMenu,
    handleResizeStart,
    eventStyleGetter
  );

  const { handleCreateTask, handleUpdateTask } = useTaskManagement();
  // Handle date selection from GoToDateCommand
  const handleGoToDate = useCallback((date) => {
    if (date) {
      setCurrentDate(date);
      if (onDateSelect) {
        onDateSelect(date);
      }
      setIsGoToDateOpen(false);
    }
  }, [onDateSelect]);

  // Sync with selectedDate prop
  useEffect(() => {
    console.log('Calendar: selectedDate prop changed to:', selectedDate);
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  const renderHeader = () => {
    const dateFormat = { month: "long", year: "numeric" };
    if (viewType === ViewType.DAY) {
      dateFormat.weekday = "long";
      dateFormat.day = "numeric";
    }

    return (

      <div className={`flex items-center justify-between px-4 pt-4 pb-2`}>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <h1 className={`text-xl font-semibold ${isSidebarVisible ? 'ml-0' : 'ml-2'}`}>
              {selectedDate.toLocaleString("en-US", { month: "long" })}
            </h1>
            <span className="text-xl font-regular text-light-text/50 dark:text-dark-text/50 ml-1">
              {selectedDate.getFullYear()}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1">
          {/* View selector moved to the top header */}
        </div>
      </div>
    );
  };

  const handleDrop = (e, date) => {
    e.preventDefault();
    try {
      const taskData = JSON.parse(e.dataTransfer.getData("application/json"));
      let dropTime;

      if (viewType === ViewType.MONTH) {
        // For month view, default to 9 AM of the dropped date
        dropTime = new Date(date);
        dropTime.setHours(9, 0, 0, 0);
      } else {
        const timeGridRect = e.currentTarget.getBoundingClientRect();

        // Calculate vertical position for time
        const dropY = e.clientY - timeGridRect.top;
        const totalMinutes = Math.floor(
          (dropY / timeGridRect.height) * 24 * 60
        );
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (viewType === ViewType.WEEK) {
          // Calculate horizontal position for day in week view
          const dropX = e.clientX - timeGridRect.left;
          const dayWidth = timeGridRect.width;
          const dayIndex = Math.floor(dropX / dayWidth);

          // Get the start of the week and add days based on drop position
          const startOfWeek = getStartOfWeek(selectedDate);
          dropTime = addDays(startOfWeek, dayIndex);
        } else {
          // Day view - use the selected date
          dropTime = new Date(date);
        }

        dropTime.setHours(
          Math.max(0, Math.min(23, hours)), // Clamp hours between 0-23
          Math.max(0, Math.min(59, minutes)), // Clamp minutes between 0-59
          0,
          0
        );
      }

      const newEvent = {
        id: `task-${taskData.id}`,
        title: taskData.title,
        start: dropTime,
        end: new Date(dropTime.getTime() + 60 * 60 * 1000), // 1 hour duration
        color:
          taskData.tag?.color ||
          colors[Math.floor(Math.random() * colors.length)],
      };

      setEvents((prevEvents) => {
        // Remove any existing repeated events with the same base ID
        const nonRepeatedEvents = prevEvents.filter(
          (e) => !e.id.includes(newEvent.id)
        );

        // Generate repeated events if repeat option is set
        let allEvents;
        if (newEvent.repeat && newEvent.repeat !== "none") {
          const repeatedEvents = generateRepeatedEvents(
            newEvent,
            newEvent.repeat
          );
          allEvents = [...nonRepeatedEvents, ...repeatedEvents];
        } else {
          allEvents = [...nonRepeatedEvents, newEvent];
        }

        // Save to localStorage
        localStorage.setItem("calendarEvents", JSON.stringify(allEvents));
        return allEvents;
      });

      setDragState((prevState) => {
        const currentPreview = prevState.dropPreview;
        if (!currentPreview) return prevState;

        const snapToInterval = (date) => {
          const minutes = date.getMinutes();
          const snappedMinutes = Math.round(minutes / 15) * 15;
          const newDate = new Date(date);
          newDate.setMinutes(snappedMinutes);
          return newDate;
        };

        const isReverse = currentPreview.end < currentPreview.start;
        const snappedStart = snapToInterval(
          isReverse ? currentPreview.end : currentPreview.start
        );
        const snappedEnd = snapToInterval(
          isReverse ? currentPreview.start : currentPreview.end
        );

        // Only open command bar if we're not dragging an existing event
        if (!prevState.eventId) {
          commandBarRef.current?.openWithDragData(snappedStart, snappedEnd);
        }

        const newState = {
          ...prevState,
          isDragging: false,
          isEventCreationOpen: !prevState.eventId, // Only set to true if not dragging existing event
          dropPreview: {
            start: snappedStart,
            end: snappedEnd,
          },
        };
        return newState;
      });

      // Reset click state after drag operation
      setClickState({
        lastClickTime: 0,
        lastClickPosition: null,
        clickCount: 0,
      });
    } catch (error) {
      console.error("Error handling drop:", error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleUp = () => {
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleUp);

    setDragState((prevState) => {
      const currentPreview = prevState.dropPreview;
      if (!currentPreview) return prevState;

      const snapToInterval = (date) => {
        const minutes = date.getMinutes();
        const snappedMinutes = Math.round(minutes / 15) * 15;
        const newDate = new Date(date);
        newDate.setMinutes(snappedMinutes);
        return newDate;
      };

      const isReverse = currentPreview.end < currentPreview.start;
      const snappedStart = snapToInterval(
        isReverse ? currentPreview.end : currentPreview.start
      );
      const snappedEnd = snapToInterval(
        isReverse ? currentPreview.start : currentPreview.end
      );

      // Only open command bar if we're not dragging an existing event
      if (!prevState.eventId) {
        commandBarRef.current?.openWithDragData(snappedStart, snappedEnd);
      }

      const newState = {
        ...prevState,
        isDragging: false,
        isEventCreationOpen: !prevState.eventId, // Only set to true if not dragging existing event
        dropPreview: {
          start: snappedStart,
          end: snappedEnd,
        },
      };
      return newState;
    });

    // Reset click state after drag operation
    setClickState({
      lastClickTime: 0,
      lastClickPosition: null,
      clickCount: 0,
    });
  };

  // Context menu is now handled by the popover component

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isViewDropdownOpen &&
        viewDropdownRef.current &&
        !viewDropdownRef.current.contains(event.target)
      ) {
        setIsViewDropdownOpen(false);
      }
    };

    if (isViewDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isViewDropdownOpen]);

  return (
    <div className="flex flex-col h-full relative isolate">
      {/* Full-width header */}
      <div className='w-full h-14 bg-light-bg-light dark:bg-dark-bg flex items-center justify-between px-3'>
        <div className="flex items-center">
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsSidebarVisible(!isSidebarVisible)}
                  className="flex group w-[32px] h-[32px] items-center justify-center rounded-[7px] hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter transition-colors"
                >
                  <SidebarIcon className="w-5 h-5 text-light-text dark:text-dark-text" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start">
                {isSidebarVisible ? 'Close Sidebar' : 'Open Sidebar'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        
        {/* View selector */}
        <div className="flex items-center justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <div
                className="flex items-center cursor-pointer flex-row px-2.5 h-[36px] font-medium shadow-sm bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% hover:bg-gradient-to-b hover:from-light-bg-light hover:to-light-bg-lighter dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] dark:hover:bg-gradient-to-b dark:hover:from-dark-bg-lighter dark:hover:to-dark-bg-lighter hover:bg-gradient-to-b outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border dark:hover:bg-white/10 text-light-text text-xs dark:text-dark-text hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
              >
                <span className="text-xs px-0.5 font-medium text-light-text dark:text-dark-text">
                  {viewType === ViewType.DAY
                    ? "Day"
                    : viewType === ViewType.WEEK
                    ? "Week"
                    : "Month"}
                </span>
                <svg
                  className="w-4 h-4 ml-2 text-light-text/50 dark:text-dark-text/50 transition-transform"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M19 9l-7 7-7-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1 min-w-[120px] bg-dark-bg-lighter dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-[9px] shadow-lg">
              <div className="flex flex-col gap-1">
                {Object.values(ViewType).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setViewType(type);
                    }}
                    className={`w-full rounded text-left px-2 py-1 text-xs font-medium flex items-center justify-between ${
                      viewType === type
                        ? "text-dark-text text-xs dark:text-dark-text bg-black/5 dark:bg-white/5"
                        : "text-dark-text/50 text-xs dark:text-dark-text/50 hover:bg-white/15 dark:hover:bg-white/5"
                    }`}
                  >
                    <span>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </span>
                    <span className="text-dark-text/30 dark:text-dark-text/30 text-[8px] border h-[20px] w-[20px] rounded-[5px] flex items-center justify-center border-light-border-2 dark:border-dark-border">
                      {type.charAt(0).toUpperCase()}
                    </span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      {/* Main content area with sidebar and calendar views */}
      <div className="flex flex-1 overflow-hidden">
        <TooltipProvider delayDuration={1000}>
        <AnimatePresence initial={false} mode="sync">
        {isSidebarVisible && (
          <motion.div
            initial={{ x: "-100%", width: 0 }}
            animate={{ x: 0, width: 280 }}
            exit={{ x: "-100%", width: 0 }}
            transition={{
              type: "easeInOut",
              duration: 0.2,
              ease: [0.25, 1, 0.5, 1],
            }}
            className="overflow-hidden h-full"
          >
            <div className="w-[280px] h-full">
              <Sidebar
                commandBarRef={commandBarRef}
                events={events}
                selectedDate={selectedDate}
                onDateSelect={(date) => {
                  // Update local state
                  setCurrentDate(date);
                  // Propagate to parent
                  if (onDateSelect) {
                    console.log('Calendar: Propagating date selection to parent:', date);
                    onDateSelect(date);
                  }
                }}
                setIsVisible={setIsSidebarVisible}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </TooltipProvider>
      
      <motion.div 
        className="flex-1 flex flex-col h-full bg-light-bg-light dark:bg-dark-bg relative"
        layout
        transition={{
          type: "easeInOut",
          duration: 0.2,
          ease: [0.25, 1, 0.5, 1],
        }}
      >
        {/* Calendar content wrapper */}
        <div className="flex flex-col flex-1 mt-[1px] ml-3 mr-3 mb-3 bg-light-bg rounded-[9px] outline outline-[1px] outline-light-border dark:bg-dark-bg-light dark:outline-dark-border shadow-lg ">
          {/* Add header with z-index to ensure it's clickable */}
          <div className="z-20 relative">
            {renderHeader()}
          </div>
          {/* Calendar views */}
          <div className="flex-1 overflow-hidden flex flex-col relative" style={{ zIndex: 1 }}>
            <div className="absolute inset-0 flex flex-col">
              {viewType === ViewType.WEEK && (
                <Week
                  selectedDate={selectedDate}
                  events={displayEvents}
                  dragState={dragState}
                  setPendingEventCell={setPendingEventCell}
                  pendingEventCell={pendingEventCell}
                  handleEventClick={handleEventClick}
                  handleEventContextMenu={handleEventContextMenu}
                  handleCellDragStart={handleCellDragStart}
                  handleCellClick={handleCellClick}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  getTimeFromMousePosition={getTimeFromMousePosition}
                  getColumnFromMousePosition={getColumnFromMousePosition}
                  renderEvents={renderEvents}
                  renderAllDayEvents={renderAllDayEvents}
                  timeGridRef={timeGridRef}
                  commandBarRef={commandBarRef}
                />
              )}
              {viewType === ViewType.DAY && (
                <Day
                  selectedDate={selectedDate}
                  events={displayEvents}
                  dragState={dragState}
                  pendingEventCell={pendingEventCell}
                  setPendingEventCell={setPendingEventCell}
                  handleEventClick={handleEventClick}
                  handleEventContextMenu={handleEventContextMenu}
                  handleCellDragStart={handleCellDragStart}
                  handleCellClick={handleCellClick}
                  handleDragOver={handleDragOver}
                  handleDrop={handleDrop}
                  getTimeFromMousePosition={getTimeFromMousePosition}
                  getColumnFromMousePosition={getColumnFromMousePosition}
                  renderEvents={renderEvents}
                  timeGridRef={timeGridRef}
                  commandBarRef={commandBarRef}
                />
              )}
              {viewType === ViewType.MONTH && (
                <Month
                  selectedDate={selectedDate}
                  events={displayEvents}
                  handleEventClick={handleEventClick}
                  handleEventContextMenu={handleEventContextMenu}
                />
              )}
            </div>
          </div>
        </div>
        {/* Context menu using Popover */}
        <Popover open={contextMenu.show} onOpenChange={(open) => !open && setContextMenu({ show: false, eventId: null, x: 0, y: 0 })}>
          {/* Empty trigger positioned at the right-click location */}
          <PopoverTrigger asChild>
            <div 
              className="fixed w-0 h-0 overflow-hidden" 
              style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            />
          </PopoverTrigger>
          <PopoverContent 
            ref={contextMenuRef}
            className="bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden z-50 border border-light-border dark:border-dark-border w-[280px] p-0"
            sideOffset={5}
            align="start"
            side="bottom"
            forceMount
          >
            <div>
              <div className="flex flex-wrap gap-2 pb-2 p-3">
                {colors.map((color) => (
                  <motion.button
                    key={color}
                    whileHover={{ scale: 1.02 }}
                    className="w-5 h-5 rounded-md hover:ring-1 hover:ring-offset-1 hover:ring-light-border hover:dark:ring-dark-border transition-all"
                    style={{ backgroundColor: color }}
                    onClick={(e) => handleColorSelect(e, color)}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                ))}
              </div>
              <div className="border-t border-light-border-2 dark:border-dark-border mt-2" />
              <div className="p-1">
                <button
                  className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-dark-border-2 transition-all"
                  onClick={(e) => handleEventDuplicate(e)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Copy className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                  Duplicate
                </button>

                <button
                  className="w-full group text-left px-2 py-2 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                  onClick={(e) => handleEventDelete(e)}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white  group-hover:dark:text-white group-hover:dark:text-white" />
                  Delete
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <DeleteEventModal
          isOpen={deleteModalState.isOpen}
          eventTitle={deleteModalState.event?.title}
          onClose={handleDeleteModalClose}
          onDelete={handleDeleteConfirm}
        />
        <RepeatEditModal
          isOpen={repeatEditModalState.isOpen}
          eventTitle={repeatEditModalState.event?.title}
          onClose={handleRepeatEditDiscard}
          onEditConfirm={handleRepeatEditConfirm}
          originalEvent={repeatEditModalState.originalEvent}
          draggedEvent={repeatEditModalState.draggedEvent}
          isEditOperation={repeatEditModalState.isEditOperation}
          commandBarRef={commandBarRef}
        />
        <GoToDateCommand
          isOpen={isGoToDateOpen}
          onClose={() => setIsGoToDateOpen(false)}
          onDateSelect={handleGoToDate}
        />
      </motion.div>
      <CommandBar
        ref={commandBarRef}
        onCreateEvent={useCallback(handleCreateEvent, [])}
        onUpdateEvent={useCallback(handleUpdateEvent, [])}
        onPrevious={useCallback(
          () => handlePrevious(viewType, currentDate, onDateSelect),
          [viewType, currentDate, onDateSelect]
        )}
        onNext={useCallback(
          () => handleNext(viewType, currentDate, onDateSelect),
          [viewType, currentDate, onDateSelect]
        )}
        onToday={useCallback(() => handleToday(onDateSelect), [onDateSelect])}
        onClose={useCallback(handleCommandBarClose, [])}
        onCreateTask={useCallback((newTask) => handleCreateTask(newTask), [])}
        onUpdateTask={useCallback(
          (updateTask) => handleUpdateTask(updateTask),
          []
        )}
        onDateSelect={useCallback((date) => handleGoToDate(date), [handleGoToDate])}
      />
      </div>
    </div>
  );
}
