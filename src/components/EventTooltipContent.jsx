import { format, differenceInMinutes } from 'date-fns';
import { Calendar as CalendarIcon } from '@/assets/icons/Calendar';
import { Clock as ClockIcon } from '@/assets/icons/Clock';
import { Repeat as RepeatIcon } from '@/assets/icons/Repeat';
import { RRule } from 'rrule';

// RRule weekday constants map: MO=0, TU=1, WE=2, TH=3, FR=4, SA=5, SU=6
const weekdayMap = [
  RRule.MO,
  RRule.TU,
  RRule.WE,
  RRule.TH,
  RRule.FR,
  RRule.SA,
  RRule.SU,
];

function formatDuration(start, end) {
  const minutes = differenceInMinutes(end, start);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  let durationString = '';
  if (hours > 0) {
    durationString += `${hours}hr `;
  }
  if (remainingMinutes > 0) {
    durationString += `${remainingMinutes}min`;
  }
  return durationString.trim() || '0min'; // Handle zero duration
}

export default function EventTooltipContent({ event }) {
  if (!event) return null;

  const startDate = new Date(event.start);
  const endDate = new Date(event.end);

  let repeatText = 'Does not repeat';
  if (event.rruleOptions) {
    try {
      // Deep clone to avoid modifying the original event object
      let processedOptions = JSON.parse(JSON.stringify(event.rruleOptions));

      // Ensure byweekday contains RRule.Weekday instances
      if (processedOptions.byweekday) {
        processedOptions.byweekday = processedOptions.byweekday.map(wday => {
          // Handle numbers (0-6) or objects { weekday: 0 }
          const dayIndex = (typeof wday === 'number') ? wday : wday?.weekday;
          if (typeof dayIndex === 'number' && dayIndex >= 0 && dayIndex <= 6) {
            return weekdayMap[dayIndex]; // Use the map to get the constant
          } else {
            console.warn("Skipping invalid byweekday value:", wday);
            return null; // Skip invalid values
          }
        }).filter(Boolean); // Remove any nulls
      }

      // Add dtstart for accurate text generation
      processedOptions.dtstart = startDate;

      const rule = new RRule(processedOptions); // Use processed options
      repeatText = `Repeats ${rule.toText()}`;
      // Capitalize first letter
      repeatText = repeatText.charAt(0).toUpperCase() + repeatText.slice(1);
    } catch (e) {
      console.error("Error parsing rrule for tooltip", e);
      repeatText = 'Repeats (invalid rule)';
    }
  } else if (event.repeat && event.repeat !== 'none') {
     // Handle legacy repeat strings if necessary, otherwise rely on rruleOptions
     repeatText = `Repeats ${event.repeat}`;
  }

  const duration = formatDuration(startDate, endDate);

  return (
    <div className="p-3 flex flex-col gap-2 bg-dark-bg-darker text-white">
      {/* Title & Description */}
      <div className="flex items-stretch gap-2 mb-3">
        <div
          className="w-1 rounded-full flex-shrink-0"
          style={{ backgroundColor: event.color || '#808080' }}
        />
        <div>
          <p className="font-semibold text-sm text-dark-text truncate">{event.title || 'No Title'}</p>
          <p className="text-xs font-regular text-dark-text/70 truncate">{event.description || 'No event description...'}</p>
        </div>
      </div>

      {/* Date */}
      <div className="flex flex-col items-start gap-1 mb-2">
        <div className="flex items-center gap-1">
          <CalendarIcon className="w-3.5 h-3.5 text-dark-text/50 flex-shrink-0" />
          <span className="text-xs text-dark-text/50">Date</span>
        </div>
        <div className="flex items-center text-xs gap-1 text-dark-text">
          <span className="text-xs text-dark-text bg-dark-bg-dark py-1 rounded-full bg-white/10 dark:bg-white/5 px-2">{format(startDate, 'dd/MM/yy')}</span> <span className="text-dark-text/50">{format(startDate, 'EEE, d')}</span>
        </div>
      </div>

      {/* Time & Duration */}
      <div className="flex flex-col items-start gap-1 mb-2">
        <div className="flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5 text-dark-text/50 flex-shrink-0" />
            <span className="text-xs text-dark-text/50">Time</span>
        </div>
        <div className="flex items-center gap-1">
            <span className="text-xs text-dark-text bg-dark-bg-dark py-1 rounded-full bg-white/10  dark:bg-white/5 px-2">
                {format(startDate, 'h:mmaaa')} - {format(endDate, 'h:mmaaa')}
            </span>
            <span className="text-xs text-dark-text/50 bg-dark-bg-dark py-0.5 rounded  dark:bg-white/5">
                {duration}
            </span>
        </div>
      </div>

      {/* Repeat */}
      <div className="flex flex-col items-start gap-1 mb-2">
        <div className="flex items-center gap-1">
            <RepeatIcon className="w-3.5 h-3.5 text-dark-text/50 flex-shrink-0" />
            <span className="text-xs text-dark-text/50">Repeat</span>
        </div>
        <div className="flex items-center">  

            <p className="text-xs text-dark-text bg-dark-bg-dark py-1 rounded-full bg-white/10 dark:bg-white/5 px-2">{repeatText}</p>
        </div>
      </div>
    </div>
  );
}
