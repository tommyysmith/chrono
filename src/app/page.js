'use client';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Calendar from '../components/Calendar';

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    // Create date using local time to ensure consistent behavior
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  return (
    <main className="w-full h-screen overflow-hidden flex">
      
      <div className="flex-1 overflow-auto">
        <Calendar selectedDate={selectedDate} onDateSelect={setSelectedDate} />
      </div>
      
    </main>
  );
}
