'use client';
import { useState } from 'react';
import Calendar from '../components/Calendar';
import AuthWrapper from '../components/AuthWrapper';
import UserMenu from '../components/UserMenu';
import CalendarSync from '../components/CalendarSync';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    // Create date using local time to ensure consistent behavior
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  return (
    <AuthWrapper>
      {/* Auto-sync calendar events */}
      <CalendarSync />
      
      <main className="w-full h-screen overflow-hidden flex flex-col">
      
        
        <div className="flex-1 overflow-auto">
          <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
        </div>
      </main>
    </AuthWrapper>
  );
}
