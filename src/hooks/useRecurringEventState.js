import { useState, useCallback } from 'react';

export function useRecurringEventState() {
  const [manipulatedEventState, setManipulatedEventState] = useState(null);

  const captureManipulatedState = useCallback((event, manipulatedEvent, operationType) => {
    // Store the exact state at the time of manipulation
    setManipulatedEventState({
      originalEvent: {
        ...event,
        start: new Date(event.start),
        end: new Date(event.end)
      },
      manipulatedEvent: {
        ...manipulatedEvent,
        start: new Date(manipulatedEvent.start),
        end: new Date(manipulatedEvent.end)
      },
      operationType,
      timeChange: {
        startDiff: manipulatedEvent.start.getTime() - event.start.getTime(),
        endDiff: manipulatedEvent.end.getTime() - event.end.getTime()
      }
    });
  }, []);

  const clearManipulatedState = useCallback(() => {
    setManipulatedEventState(null);
  }, []);

  return {
    manipulatedEventState,
    captureManipulatedState,
    clearManipulatedState
  };
}
