import { useState, useCallback, useEffect } from "react";
import { generateEventId } from "../utils/eventUtils";
import { generateRecurringEvents, updateSeriesEvents, getEventsInSeries } from "../utils/recurrenceUtils";

export function useEventManagement(commandBarRef) {
  const [events, setEvents] = useState([]);
  const [editingEventId, setEditingEventId] = useState(null);

  // Load events from localStorage when component mounts
  useEffect(() => {
    const savedEvents = localStorage.getItem("calendarEvents");
    if (savedEvents) {
      try {
        const parsedEvents = JSON.parse(savedEvents).map((event) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }));
        setEvents(parsedEvents);
      } catch (error) {
        console.error("Error parsing saved events:", error);
        setEvents([]);
      }
    }
  }, []);

  // Save events to localStorage whenever they change
  useEffect(() => {
    if (events.length > 0) {
      localStorage.setItem("calendarEvents", JSON.stringify(events));
    } else {
      // Clear localStorage when all events are deleted
      localStorage.removeItem("calendarEvents");
    }
  }, [events]);

  const handleCreateEvent = useCallback(
    (eventData) => {
      // Ensure we have valid start/end times
      const start = eventData.start instanceof Date ? eventData.start : new Date(eventData.start);
      const end = eventData.end instanceof Date ? eventData.end : new Date(eventData.end);
      
      // Generate a new series ID if this is a repeat event
      const seriesId = eventData.repeat && eventData.repeat !== 'none' ? generateEventId() : null;
      
      const newEvent = {
        ...eventData,
        id: generateEventId(),
        start,
        end,
        seriesId,
        isRepeat: Boolean(seriesId)
      };

      setEvents((prev) => {
        let newEvents = [...prev];
        
        // For recurring events, generate all instances
        if (seriesId) {
          // Generate recurring event instances
          const recurringEvents = generateRecurringEvents(newEvent);
          newEvents = [...prev, ...recurringEvents];
        } else {
          // Non-recurring event
          newEvents = [...prev, newEvent];
        }
        
        return newEvents;
      });

      // Immediately open CommandBar for editing
      if (commandBarRef.current) {
        commandBarRef.current.openForEdit(newEvent);
      }

      return newEvent;
    },
    [commandBarRef]
  );

  const handleUpdateEvent = useCallback((updatedEvent) => {
    console.log('useEventManagement - handleUpdateEvent:', updatedEvent);
    
    // Extract special properties from the event
    const { 
      _editScope, 
      _seriesUpdate, 
      _exactPosition, 
      _timeChange,
      _originalEvent,
      _updateSeries,
      _isBaseEvent,
      _isSeriesEvent,
      _isDragging,
      _isResizing,
      _preserveRepeat,
      ...cleanEventData
    } = updatedEvent;

    // Clean the event object by removing special properties
    const cleanEvent = { ...cleanEventData };
    delete cleanEvent._editScope;
    delete cleanEvent._seriesUpdate;
    delete cleanEvent._exactPosition;
    delete cleanEvent._timeChange;
    delete cleanEvent._originalEvent;
    delete cleanEvent._updateSeries;
    delete cleanEvent._isBaseEvent;
    delete cleanEvent._isSeriesEvent;
    delete cleanEvent._isDragging;
    delete cleanEvent._isResizing;
    delete cleanEvent._preserveRepeat;

    // Store important metadata before we remove it
    const currentDate = updatedEvent._currentDate || new Date();
    const isBeingManipulated = updatedEvent._isBeingManipulated;

    // Remove internal properties that shouldn't be stored
    delete cleanEvent._editScope;
    delete cleanEvent._repeatChanged;
    delete cleanEvent._timeChange;
    delete cleanEvent._originalSeriesId;
    delete cleanEvent._preserveSeriesEvents;
    delete cleanEvent._seriesUpdate;
    delete cleanEvent._futureUpdate;
    delete cleanEvent._exactPosition;
    delete cleanEvent._originalEvent;
    delete cleanEvent._isBeingManipulated;
    delete cleanEvent._currentDate;
    delete cleanEvent._preserveRepeat;
    delete cleanEvent._forceSeriesUpdate;
    delete cleanEvent._updateSeries;

    // Ensure we have valid start/end times
    cleanEvent.start = cleanEvent.start instanceof Date ? cleanEvent.start : new Date(cleanEvent.start);
    cleanEvent.end = cleanEvent.end instanceof Date ? cleanEvent.end : new Date(cleanEvent.end);

    setEditingEventId(null);

    setEvents((prev) => {
      // Create a fresh copy of the events array to avoid state mutation issues
      let updatedEvents = JSON.parse(JSON.stringify(prev)).map(event => ({
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      }));
      
      // Get the seriesId whether from original or existing event
      const seriesId = updatedEvent.seriesId || prev.find(e => e.id === updatedEvent.id)?.seriesId;
      
      // Calculate time differences if needed
      const startDiff = _exactPosition 
        ? _exactPosition.start.getTime() - prev.find(e => e.id === updatedEvent.id).start.getTime()
        : _timeChange?.startDiff || cleanEvent.start.getTime() - prev.find(e => e.id === updatedEvent.id).start.getTime();
      const endDiff = _exactPosition
        ? _exactPosition.end.getTime() - prev.find(e => e.id === updatedEvent.id).end.getTime()
        : _timeChange?.endDiff || cleanEvent.end.getTime() - prev.find(e => e.id === updatedEvent.id).end.getTime();

      const hasRepeatChanged = prev.find(e => e.id === updatedEvent.id).repeat !== cleanEvent.repeat;

      // Handle different edit scopes
      switch (_editScope) {
        case 'single': {
          // For single event edits, detach from the series
          const eventIndex = updatedEvents.findIndex(e => e.id === updatedEvent.id);
          if (eventIndex !== -1) {
            updatedEvents[eventIndex] = {
              ...cleanEvent,
              id: updatedEvent.id,
              seriesId: null,
              repeat: "none",
              isRepeat: false,
              start: _exactPosition ? new Date(_exactPosition.start) : new Date(cleanEvent.start),
              end: _exactPosition ? new Date(_exactPosition.end) : new Date(cleanEvent.end),
            };
          }
          break;
        }
        
        case 'all': {
          if (seriesId) {
            console.log('Handling ALL edit scope:', {
              updatedEvent,
              timeChange: _timeChange,
              exactPosition: _exactPosition,
              originalEvent: prev.find(e => e.id === updatedEvent.id)
            });

            // Get all events in the series
            const seriesEvents = updatedEvents.filter(e => e.seriesId === seriesId);
            
            // Calculate the time shift based on the original event's changes
            const timeShift = {
              startDiff: _timeChange?.startDiff || (_exactPosition ? 
                _exactPosition.start.getTime() - prev.find(e => e.id === updatedEvent.id).start.getTime() : 0),
              endDiff: _timeChange?.endDiff || (_exactPosition ? 
                _exactPosition.end.getTime() - prev.find(e => e.id === updatedEvent.id).end.getTime() : 0)
            };

            console.log('Calculated time shift:', timeShift);

            // Update all events in the series with the new properties and time shift
            const updatedSeriesEvents = seriesEvents.map(event => {
              // Calculate new start and end times
              const newStart = new Date(event.start.getTime() + timeShift.startDiff);
              const newEnd = new Date(event.end.getTime() + timeShift.endDiff);

              const updatedSeriesEvent = {
                ...event,
                title: cleanEvent.title,
                description: cleanEvent.description,
                color: cleanEvent.color,
                isAllDay: cleanEvent.isAllDay,
                repeat: cleanEvent.repeat,
                start: newStart,
                end: newEnd
              };

              console.log('Updated series event:', {
                id: event.id,
                oldStart: event.start,
                oldEnd: event.end,
                newStart,
                newEnd,
                timeShift
              });

              return updatedSeriesEvent;
            });

            // Get all non-series events
            const nonSeriesEvents = updatedEvents.filter(e => e.seriesId !== seriesId);

            // If the repeat pattern changed, regenerate the series
            if (hasRepeatChanged) {
              const templateEvent = {
                ...updatedSeriesEvents[0],
                rrule: cleanEvent.rrule
              };
              const newSeriesEvents = generateRecurringEvents(templateEvent);
              updatedEvents = [...nonSeriesEvents, ...newSeriesEvents];
            } else {
              // Otherwise use our manually updated events
              updatedEvents = [...nonSeriesEvents, ...updatedSeriesEvents];
            }

            console.log('Final update result:', {
              eventCount: updatedEvents.length,
              seriesEventCount: updatedSeriesEvents.length,
              hasRepeatChanged,
              timeShift,
              sampleEvent: updatedSeriesEvents[0]
            });
          }
          break;
        }
        
        default: {
          // For recurring events, use the recurrence utilities
          if (seriesId) {
            console.log('Handling recurring event update:', {
              seriesId,
              isDragging: _isDragging,
              isResizing: _isResizing,
              updateSeries: _updateSeries
            });

            // Update the event being edited first
            const eventIndex = updatedEvents.findIndex(e => e.id === updatedEvent.id);
            if (eventIndex !== -1) {
              const updatedSeriesEvent = {
                ...cleanEvent,
                id: updatedEvent.id,
                seriesId: seriesId,
                isRepeat: true,
                start: _exactPosition ? new Date(_exactPosition.start) : new Date(cleanEvent.start),
                end: _exactPosition ? new Date(_exactPosition.end) : new Date(cleanEvent.end)
              };
              
              // Use updateSeriesEvents to handle the update
              updatedEvents = updateSeriesEvents(
                updatedEvents, 
                updatedSeriesEvent, 
                {
                  timeChange: Boolean(_timeChange || _exactPosition),
                  propertiesOnly: !(_timeChange || _exactPosition),
                  regenerate: hasRepeatChanged || _seriesUpdate || _forceSeriesUpdate || _updateSeries,
                  isDragging: _isDragging || false,
                  isResizing: _isResizing || false,
                  preserveRepeat: _preserveRepeat
                }
              );
            }
          } else {
            // For non-repeated events or other cases
            const eventIndex = updatedEvents.findIndex(e => e.id === updatedEvent.id);
            if (eventIndex !== -1) {
              if ((!prev.find(e => e.id === updatedEvent.id).repeat || prev.find(e => e.id === updatedEvent.id).repeat === 'none') && cleanEvent.repeat && cleanEvent.repeat !== 'none') {
                // Converting to a repeat event
                const newSeriesId = generateEventId();
                const updatedEvent = {
                  ...cleanEvent,
                  id: updatedEvent.id,
                  seriesId: newSeriesId,
                  isRepeat: true,
                  start: _exactPosition ? new Date(_exactPosition.start) : new Date(cleanEvent.start),
                  end: _exactPosition ? new Date(_exactPosition.end) : new Date(cleanEvent.end)
                };
                updatedEvents[eventIndex] = updatedEvent;
                
                // Generate recurring instances
                const newInstances = generateRecurringEvents(updatedEvent);
                updatedEvents = [...updatedEvents, ...newInstances.slice(1)];
              } else {
                // Regular single event update
                updatedEvents[eventIndex] = {
                  ...cleanEvent,
                  id: updatedEvent.id,
                  start: new Date(cleanEvent.start),
                  end: new Date(cleanEvent.end)
                };
              }
            }
          }
        }
      }

      return updatedEvents;
    });

    return updatedEvent.id;
  }, []);

  const handleDeleteEvent = useCallback((event, setDeleteModalState) => {
    const isRepeatedEvent = event.repeat && event.repeat !== "none" && event.seriesId;

    if (isRepeatedEvent) {
      setDeleteModalState({
        isOpen: true,
        event,
      });
    } else {
      setEvents((prevEvents) => {
        // Filter out the event and any orphaned series events
        const updatedEvents = prevEvents.filter((e) => {
          if (e.id === event.id) return false;
          if (event.seriesId && e.seriesId === event.seriesId) return false;
          return true;
        });
        return updatedEvents;
      });
    }
  }, []);

  const handleDeleteSeriesEvents = useCallback((event, scope) => {
    if (!event) return;
    
    setEvents((prevEvents) => {
      let updatedEvents;
      
      if (scope === 'all' && event.seriesId) {
        // Delete all events in the series
        updatedEvents = prevEvents.filter(e => e.seriesId !== event.seriesId);
      } else if (scope === 'single' && event.id) {
        // Delete just this instance and any orphaned series events
        updatedEvents = prevEvents.filter(e => {
          if (e.id === event.id) return false;
          if (event.seriesId && e.seriesId === event.seriesId) return false;
          return true;
        });
      } else {
        // If something's wrong with the event data, just return current state
        return prevEvents;
      }
      
      return updatedEvents;
    });
  }, []);

  return {
    events,
    setEvents,
    handleCreateEvent,
    handleUpdateEvent,
    handleDeleteEvent,
    handleDeleteSeriesEvents,
    editingEventId,
    setEditingEventId
  };
}
