import { format } from "date-fns";
import { useDraggable } from '@dnd-kit/core';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Repeat } from "@/assets/icons/Repeat";
import { Tag } from "@/assets/icons/Tag";
import { None } from "@/assets/icons/None";
import { Low } from "@/assets/icons/Low";
import { Medium } from "@/assets/icons/Medium";
import { High } from "@/assets/icons/High";
import Checkbox from "@/components/Checkbox";

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

// Helper function to get priority color
const getPriorityColor = (priority) => {
  switch (priority) {
    case 'High':
      return '#EF4444';
    case 'Medium':
      return '#F59E0B';
    case 'Low':
      return '#10B981';
    case 'None':
    default:
      return '#6B7280';
  }
};

const TaskEventItem = ({
  event,
  eventStyle,
  viewType,
  dragState,
  onDragStart,
  onDoubleClick,
  onContextMenu,
  onResizeStart,
  onToggleTaskCompletion,
  getFreshTagData,
}) => {


  const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;
  const repeatClass = isRepeatEvent ? "repeat-event" : "";

  // Calculate if this is a 15-minute task event - use live dimensions during resize
  const is15MinTaskEvent = (() => {
    // Check current event times (these should update during resize)
    if (event.start && event.end) {
      const currentDuration = new Date(event.end).getTime() - new Date(event.start).getTime();
      const durationInMinutes = currentDuration / (60 * 1000);
      return Math.abs(durationInMinutes - 15) < 1; // 1 minute tolerance
    }
    
    // Fallback to original task duration
    return event.originalTask?.duration === 15;
  })();

  // Setup @dnd-kit draggable for TaskEventItems
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `task-event-${event.id}`,
    data: {
      type: 'task-event',
      event: event,
      originalTask: event.originalTask
    },
  });

  // Transform style for dragging
  const dragStyle = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const getTaskEventClasses = () => {
    const baseClasses = "absolute z-10 overflow-hidden cursor-pointer select-none event-item";
    const editingClasses = event.isEditing || dragState.eventId === event.id ? "" : "";

    if (event.isTaskBlock) {
      return `${baseClasses} bg-light-bg-light dark:bg-dark-bg-lighter text-light-text dark:text-dark-text border border-dashed border-light-border dark:border-dark-border rounded-[5px] ${editingClasses}`;
    }

    return `${baseClasses} border-1 border-dashed border-light-border dark:border-dark-border rounded-[5px] bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm ${
      editingClasses
        ? "border-primary bg-gray-100/90 dark:bg-gray-700/90"
        : "border-gray-300 dark:border-gray-600"  
    }`;
  };

  const getRepeatTooltipText = () => {
    if (event.originalTask.repeat && event.originalTask.repeat !== 'none') {
      return event.originalTask.repeat;
    }
    if (event.originalTask.originalBaseId) {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) {
        const tasks = JSON.parse(savedTasks);
        const baseTask = tasks.all?.find(t => t.id === event.originalTask.originalBaseId);
        return baseTask?.repeat || 'unknown';
      }
    }
    return 'unknown';
  };

  const shouldShowRepeatIndicator = () => {
    return ((event.originalTask?.repeat && event.originalTask.repeat !== 'none') || 
            (event.originalTask?.seriesId && event.originalTask?.originalBaseId));
  };

  const shouldShowPriorityIndicator = () => {
    return event.originalTask?.priority && event.originalTask.priority !== 'None';
  };



  return (
    <TooltipProvider delayDuration={2000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            ref={setNodeRef}
            className={`${getTaskEventClasses()} ${repeatClass} ${isDragging ? 'opacity-0' : ''}`}
            style={{ ...eventStyle, ...dragStyle }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick(event);
            }}
            onContextMenu={(e) => onContextMenu(e, event)}
            {...attributes}
          >
            {/* Draggable area - excludes resize handles */}
            <div 
              className="absolute inset-0 cursor-pointer z-0"
              {...listeners}
            />
            {/* iOS-style resize handles - only visible on hover */}
            <div
              className={`absolute top-0 h-3 cursor-ns-resize resize-handle flex items-center justify-center group z-20 ${is15MinTaskEvent ? 'left-[15%] right-[15%]' : 'left-0 right-0'}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(e, event.id, "top");
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-8 h-0.5 bg-gray-400/40 dark:bg-gray-500/40 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 group-hover:bg-gray-500/60 dark:group-hover:bg-gray-400/60 group-active:bg-gray-600/80 dark:group-active:bg-gray-300/80 group-active:h-1 transition-all duration-150" />
            </div>
            <div
              className={`absolute bottom-0 h-3 cursor-ns-resize resize-handle flex items-center justify-center group z-20 ${is15MinTaskEvent ? 'left-[15%] right-[15%]' : 'left-0 right-0'}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(e, event.id, "bottom");
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-8 h-0.5 bg-gray-400/40 dark:bg-gray-500/40 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 group-hover:bg-gray-500/60 dark:group-hover:bg-gray-400/60 group-active:bg-gray-600/80 dark:group-active:bg-gray-300/80 group-active:h-1 transition-all duration-150" />
            </div>

            {/* Task content */}
            <div className={`relative z-10 pointer-events-none ${is15MinTaskEvent ? 'px-1 py-0.5 flex items-center h-full' : 'px-1 py-1'}`}>
              {event.isTaskBlock ? (
                <div className={`flex flex-col gap-1 ${is15MinTaskEvent ? 'items-center' : ''}`}>
                  <div className={`font-medium text-xs flex items-center gap-2 ${is15MinTaskEvent ? 'gap-1' : ''}`}>
                    <div className="pointer-events-auto">
                      <Checkbox 
                        checked={event.originalTask?.completed || false}
                        onChange={() => {
                          if (onToggleTaskCompletion && event.originalTask) {
                            onToggleTaskCompletion(event.originalTask, 'single');
                          }
                        }}
                      />
                    </div>
                    <span>{event.title}</span>
                    {is15MinTaskEvent && (() => {
                      // Calculate time display for 15-minute events  
                      if (event.start && event.end) {
                        return (
                          <span className="text-light-text/30 dark:text-dark-text/30">
                            {format(event.start, "h:mm a")}
                          </span>
                        );
                      }
                      if (event.originalTask?.scheduledDate) {
                        const startDate = new Date(event.originalTask.scheduledDate);
                        return (
                          <span className="text-light-text/30 dark:text-dark-text/30">
                            {format(startDate, "h:mm a")}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  {!is15MinTaskEvent && (
                  <div className="text-xs text-light-text/50 dark:text-dark-text/50 ml-5">
                    {(() => {
                      // If event has proper start/end times, use them
                      if (event.start && event.end) {
                        return `${format(event.start, "h:mm a")} - ${format(event.end, "h:mm a")}`;
                      }
                      // Fallback to calculating from task's scheduledDate and duration
                      if (event.originalTask?.scheduledDate) {
                        const startDate = new Date(event.originalTask.scheduledDate);
                        if (event.originalTask.duration && event.originalTask.duration > 0) {
                          const endDate = new Date(startDate.getTime() + (event.originalTask.duration * 60 * 1000));
                          return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
                        } else {
                          // Default to 1 hour if no duration
                          const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
                          return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
                        }
                      }
                      return "Time not set";
                    })()}
                  </div>
                  )}
                </div>
              ) : (
                <div className={`${is15MinTaskEvent ? 'flex items-center gap-1' : ''}`}>
                  <div className="font-medium text-xs">
                    <span>{event.title}</span>
                    {is15MinTaskEvent && (() => {
                      // Calculate time display for 15-minute events  
                      if (event.start && event.end) {
                        return (
                          <span className="text-light-text/30 dark:text-dark-text/30 ml-1">
                            {format(event.start, "h:mm a")}
                          </span>
                        );
                      }
                      if (event.originalTask?.scheduledDate) {
                        const startDate = new Date(event.originalTask.scheduledDate);
                        return (
                          <span className="text-light-text/30 dark:text-dark-text/30 ml-1">
                            {format(startDate, "h:mm a")}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  {!is15MinTaskEvent && (
                  <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                    {(() => {
                      // If event has proper start/end times, use them
                      if (event.start && event.end) {
                        return `${format(event.start, "h:mm a")} - ${format(event.end, "h:mm a")}`;
                      }
                      // Fallback to calculating from task's scheduledDate and duration
                      if (event.originalTask?.scheduledDate) {
                        const startDate = new Date(event.originalTask.scheduledDate);
                        if (event.originalTask.duration && event.originalTask.duration > 0) {
                          const endDate = new Date(startDate.getTime() + (event.originalTask.duration * 60 * 1000));
                          return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
                        } else {
                          // Default to 1 hour if no duration
                          const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
                          return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
                        }
                      }
                      return "Time not set";
                    })()}
                  </div>
                  )}
                </div>
              )}
            </div>

            {/* Absolutely positioned icons in bottom right */}
            {(shouldShowRepeatIndicator() || event.originalTask?.tag || shouldShowPriorityIndicator()) && (
              <div className="absolute bottom-1 right-1 flex items-center gap-1 z-20">
                {shouldShowRepeatIndicator() && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500">
                          <Repeat className="w-2.5 h-2.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Repeats {getRepeatTooltipText()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {event.originalTask?.tag && (
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <div className="inline-flex items-center px-1 h-[16px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px]">
                          <Tag className="w-2.5 h-2.5" style={{ color: event.originalTask.tag.color }} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{(() => {
                          const freshTag = getFreshTagData(event.originalTask.tag.id);
                          return freshTag ? freshTag.label : event.originalTask.tag.label;
                        })()}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {shouldShowPriorityIndicator() && (() => {
                  const IconComponent = getPriorityIcon(event.originalTask.priority);
                  const priorityColor = getPriorityColor(event.originalTask.priority);
                  return (
                    <TooltipProvider>
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger asChild>
                          <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-xs rounded-[4px] bg-white dark:bg-dark-bg-light">
                            <IconComponent className="w-2.5 h-2.5" style={{ color: priorityColor }} />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{event.originalTask.priority} priority</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })()}
              </div>
            )}


          </div>
        </TooltipTrigger>
        {/* No tooltip for task events */}
      </Tooltip>
    </TooltipProvider>
  );
};

// TaskEventDragPreview component for DragOverlay
export const TaskEventDragPreview = ({ event, dimensions, livePreview, getFreshTagData }) => {
  if (!event) return null;

  const taskIsRecurring = event.originalTask?.repeat && event.originalTask.repeat !== 'none';
  const hasAnyTags = taskIsRecurring || 
                     event.originalTask?.tag || 
                     (event.originalTask?.priority && event.originalTask.priority !== 'None');

  return (
    <div className="bg-light-bg-light dark:bg-dark-bg-lighter border border-dashed border-light-border dark:border-dark-border rounded-[5px] p-2 shadow-lg w-[240px] pointer-events-none opacity-100">
      <div className="flex items-start gap-2">
        {/* Checkbox placeholder */}
        <div className="w-4 h-4 mt-0.5 rounded border border-light-border dark:border-dark-border bg-light-bg-light dark:bg-dark-bg-light opacity-100"></div>
        
        <div className="flex flex-col flex-grow gap-1 min-w-0">
          {/* Title row with tags and recurring icon */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium text-light-text dark:text-dark-text break-words flex-grow opacity-100">
              {event.title || event.originalTask?.title}
            </span>
            {hasAnyTags && (
              <div className="flex items-center flex-wrap gap-1 flex-shrink-0 opacity-100">
                {event.originalTask?.tag && (
                  <div 
                    className="inline-flex items-center px-1 h-[16px] bg-white dark:bg-dark-bg-light outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] opacity-100"
                    style={{ color: event.originalTask.tag.color }}
                  >
                    <Tag className="h-2.5 w-2.5 opacity-100" style={{ color: event.originalTask.tag.color }} />
                    <span className="px-0.5 opacity-100">{getFreshTagData ? getFreshTagData(event.originalTask.tag.id)?.label || event.originalTask.tag.label : event.originalTask.tag.label}</span>
                  </div>
                )}
                
                {taskIsRecurring && (
                  <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500 opacity-100">
                    <Repeat className="h-2.5 w-2.5 opacity-100" />
                  </div>
                )}
                
                {event.originalTask?.priority && event.originalTask.priority !== 'None' && (() => {
                  const IconComponent = getPriorityIcon(event.originalTask.priority);
                  const priorityColor = getPriorityColor(event.originalTask.priority);
                  return (
                    <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light opacity-100">
                      <IconComponent className="h-2.5 w-2.5 opacity-100" style={{ color: priorityColor }} />
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
          
          {/* Live updating time range */}
          <div className="text-xs text-light-text/50 dark:text-dark-text/50 opacity-100">
            {(() => {
              // Use live preview times if available, otherwise fall back to original times
              if (livePreview && livePreview.start && livePreview.end) {
                return `${format(livePreview.start, "h:mm a")} - ${format(livePreview.end, "h:mm a")}`;
              }
              if (event.start && event.end) {
                return `${format(event.start, "h:mm a")} - ${format(event.end, "h:mm a")}`;
              }
              return "Time not set";
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskEventItem; 