// /Users/tommysmith/Documents/chrono/src/components/CalendarDataProvider.jsx
import React, { createContext, useContext } from 'react';
import { useCalendarData } from '../hooks/useCalendarData';

const CalendarDataContext = createContext(null);

export const useCalendar = () => {
  const context = useContext(CalendarDataContext);
  if (!context) {
    throw new Error('useCalendar must be used within a CalendarDataProvider');
  }
  return context;
};

export const CalendarDataProvider = ({ children }) => {
  const calendarData = useCalendarData();

  return (
    <CalendarDataContext.Provider value={calendarData}>
      {children}
    </CalendarDataContext.Provider>
  );
};
