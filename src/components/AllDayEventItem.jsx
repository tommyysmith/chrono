import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Repeat } from "@/assets/icons/Repeat";
import { Tag } from "@/assets/icons/Tag";
import Checkbox from "@/components/Checkbox";
import EventTooltipContent from "@/components/EventTooltipContent";

const AllDayEventItem = ({
  event,
  onDoubleClick,
  onContextMenu,
  onToggleTaskCompletion,
  getFreshTagData,
  isEventPast,
}) => {
  const isTask = event.isTask;
  const isPastEvent = isEventPast(event);
  
  // Check if this is an unaccepted event (user hasn't responded or declined)
  // Also check attendees array for self.responseStatus as fallback
  const selfAttendee = event.attendees?.find(a => a.self);
  const responseStatus = event.myResponseStatus || selfAttendee?.responseStatus;
  const isUnacceptedEvent = responseStatus && 
    responseStatus !== 'accepted' && 
    !event.organizer?.self;

  const getEventClasses = () => {
    const baseClasses = "flex items-center text-xs cursor-pointer hover:bg-black/5 select-none dark:hover:bg-white/5 rounded-[5px] overflow-hidden";
    const taskClasses = isTask ? "border-2 border-dashed" : "";
    const unacceptedClasses = isUnacceptedEvent && !isTask ? "border border-dashed" : "";
    return `${baseClasses} ${taskClasses} ${unacceptedClasses}`;
  };

  const getEventStyle = () => {
    // Unaccepted events: no background, just border color
    if (isUnacceptedEvent && !isTask) {
      return {
        backgroundColor: 'transparent',
        borderColor: event.color || "#808080",
        opacity: isPastEvent && !event.isTaskBlock ? 0.5 : 1,
      };
    }
    return {
      backgroundColor: isTask ? undefined : (event.color ? `${event.color}20` : "#80808020"),
      opacity: isPastEvent && !event.isTaskBlock ? 0.5 : 1,
    };
  };

  const shouldShowRepeatIndicator = () => {
    return ((event.originalTask?.repeat && event.originalTask.repeat !== 'none') || 
            (event.originalTask?.seriesId && event.originalTask?.originalBaseId));
  };

  const getRepeatTooltipText = () => {
    if (event.originalTask?.repeat && event.originalTask.repeat !== 'none') {
      return event.originalTask.repeat;
    }
    if (event.originalTask?.originalBaseId) {
      const savedTasks = localStorage.getItem('tasks');
      if (savedTasks) {
        const tasks = JSON.parse(savedTasks);
        const baseTask = tasks.all?.find(t => t.id === event.originalTask.originalBaseId);
        return baseTask?.repeat || 'unknown';
      }
    }
    return 'unknown';
  };

  return (
    <TooltipProvider delayDuration={2000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={getEventClasses()}
            style={getEventStyle()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onDoubleClick(event);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onContextMenu={(e) => onContextMenu(e, event)}
          >
            {/* Color stripe for non-task events */}
            {!isTask && !event.isDraft && (
              <div
                className="w-1 self-stretch"
                style={{ backgroundColor: event.color || "#808080" }}
              />
            )}

            <div className="px-2 py-1 w-full relative">
              <div className="flex flex-grow w-full justify-between flex-row gap-2">
                <div className="font-medium text-xs flex items-center gap-2">
                  {isTask && (
                    <Checkbox 
                      checked={event.originalTask?.completed || false}
                      onChange={() => {
                        if (onToggleTaskCompletion && event.originalTask) {
                          onToggleTaskCompletion(event.originalTask, 'single');
                        }
                      }}
                    />
                  )}
                  {event.title || 'New Event'}
                </div>
                
                {/* Badges for tasks */}
                {isTask && (
                  <div className="flex items-center gap-1 ml-auto">
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
                  </div>
                )}
              </div>
              
              {/* Multi-day indicator for day view */}
              {event.multiDayText && (
                <div className="text-xs text-light-text/30 dark:text-dark-text/30">
                  {event.multiDayText}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" align="start">
          {isTask ? (
            <div className="text-xs">
              <div className="font-medium">{event.title}</div>
              {event.originalTask.notes && (
                <div className="text-gray-400 mt-1">{event.originalTask.notes}</div>
              )}
              <div className="text-gray-400 mt-1">Task</div>
            </div>
          ) : (
            <EventTooltipContent event={event} />
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default AllDayEventItem; 