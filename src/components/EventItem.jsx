import { motion } from "framer-motion";
import { format } from "date-fns";
import { useDraggable } from '@dnd-kit/core';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Repeat } from "@/assets/icons/Repeat";
import EventTooltipContent from "@/components/EventTooltipContent";

const EventItem = ({
  event,
  eventStyle,
  viewType,
  dragState,
  onDragStart,
  onDoubleClick,
  onContextMenu,
  onResizeStart,
}) => {
  const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;
  const repeatClass = isRepeatEvent ? "repeat-event" : "";

  // Setup @dnd-kit draggable for EventItems
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `event-${event.id}`,
    data: {
      type: 'event',
      event: event
    },
  });

  // Transform style for dragging
  const dragTransform = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const getEventClasses = () => {
    const baseClasses = "absolute z-10 overflow-hidden cursor-pointer select-none event-item";
    const editingClasses = event.isEditing || dragState.eventId === event.id ? "border-primary" : "";
    
    if (event.isTaskBlock) {
      return `${baseClasses} bg-light-bg-lighter dark:bg-dark-bg-lighter text-light-text dark:text-dark-text border border-dashed border-light-border dark:border-dark-border rounded-[5px] hover:bg-black/5 dark:hover:bg-white/5 ${editingClasses}`;
    }
    
    if (event.isTask) {
      return `${baseClasses} border-1 border-dashed border-light-border dark:border-dark-border rounded-[5px] bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm ${
        editingClasses
          ? "border-primary bg-gray-100/90 dark:bg-gray-700/90"
          : "border-gray-300 dark:border-gray-600"
      }`;
    }
    
    return `${baseClasses} backdrop-blur-md rounded-[9px] ${
      editingClasses ? "bg-primary/30" : "bg-primary/10"
    }`;
  };

  return (
    <TooltipProvider delayDuration={2000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            ref={setNodeRef}
            className={`${getEventClasses()} ${repeatClass} ${isDragging ? 'opacity-50' : ''}`}
            style={{ ...eventStyle, ...dragTransform }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick(event);
            }}
            onContextMenu={(e) => onContextMenu(e, event)}
            {...attributes}
          >
            {/* Draggable area - excludes resize handles */}
            <div 
              className="absolute inset-0 top-3 bottom-3 cursor-pointer"
              {...listeners}
            />
            {/* Color stripe for non-task events */}
            {!event.isTask && !event.isTaskBlock && !event.isDraft && (
              <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ backgroundColor: event.color || "#808080" }}
              />
            )}

            {/* iOS-style resize handles - only visible on hover */}
            <div
              className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize resize-handle flex items-center justify-center group z-10"
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
              className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize resize-handle flex items-center justify-center group z-10"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onResizeStart(e, event.id, "bottom");
              }}
              style={{ pointerEvents: 'auto' }}
            >
              <div className="w-8 h-0.5 bg-gray-400/40 dark:bg-gray-500/40 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 group-hover:bg-gray-500/60 dark:group-hover:bg-gray-400/60 group-active:bg-gray-600/80 dark:group-active:bg-gray-300/80 group-active:h-1 transition-all duration-150" />
            </div>

            {/* Event content */}
            <div className="px-2 py-1 relative">
              <div className="font-medium text-xs">{event.title || 'New Event'}</div>
              <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
              </div>
              {isRepeatEvent && (
                <div className="absolute bottom-1 right-1">
                  <Repeat className="w-3 h-3" />
                </div>
              )}
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="right" align="start">
          <EventTooltipContent event={event} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// EventDragPreview component for DragOverlay
export const EventDragPreview = ({ event }) => {
  if (!event) return null;

  const isRepeatEvent = event.seriesId || (event.repeat && event.repeat !== "none") || event.rruleOptions;

  return (
    <div className="bg-light-bg-light dark:bg-dark-bg-lighter border border-light-border dark:border-dark-border rounded-[9px] p-2 shadow-lg max-w-[200px] pointer-events-none">
      <div className="flex items-start gap-2">
        {/* Color stripe */}
        {event.color && (
          <div
            className="w-1 h-full rounded-full flex-shrink-0"
            style={{ backgroundColor: event.color }}
          />
        )}
        
        <div className="flex flex-col flex-grow gap-1 min-w-0">
          <span className="text-sm font-medium text-light-text dark:text-dark-text break-words">
            {event.title || 'New Event'}
          </span>
          
          {/* Time range */}
          <div className="text-xs text-light-text/50 dark:text-dark-text/50">
            {(() => {
              if (event.start && event.end) {
                return `${format(event.start, "h:mm a")} - ${format(event.end, "h:mm a")}`;
              }
              return "Time not set";
            })()}
          </div>
          
          {isRepeatEvent && (
            <div className="flex items-center">
              <div className="inline-flex items-center px-1 h-[16px] outline outline-1 outline-light-border dark:outline-dark-border text-[10px] rounded-[4px] bg-white dark:bg-dark-bg-light text-blue-500">
                <Repeat className="h-2.5 w-2.5" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventItem; 