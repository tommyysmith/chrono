# Infinite Scroll Week View - Technical Design Document

## Overview
Implement Notion Calendar-style infinite horizontal scrolling with day snapping for the week view. Users can two-finger swipe (trackpad) or scroll horizontally to navigate through days smoothly, with the view snapping to the nearest day boundary when scrolling stops.

## Current Architecture Analysis

### Key Files & Their Responsibilities
- `Week.jsx` - Renders fixed 7-day grid with hardcoded column calculations
- `useEventRendering.js` - Filters events for current week, calculates event positions
- `useEventFiltering.js` - Determines which events fall within the visible date range
- `eventUtils.js` - `getEventStyle()` calculates `left` position as `startDayIndex * (100 / 7)`
- `positionUtils.js` - `getColumnFromMousePosition()` divides by 7 for column index
- `useDragAndDrop.js` - Drag/drop/resize logic assumes 7-column grid
- `Calendar.jsx` - State management, `selectedDate` drives which week is shown

### Current Limitations
1. **Fixed 7-day rendering** - Can't scroll between days
2. **Percentage-based positioning** - Events use `left: ${(column / 7) * 100}%`
3. **Date-driven navigation** - `selectedDate` state jumps by 7 days at a time
4. **No scroll awareness** - Event positions don't account for scroll offset

## New Architecture Design

### Core Concept: Virtualized Day Columns
Instead of rendering exactly 7 days, we render a **window of days** (e.g., 21-35 days) and use CSS scroll-snap for native snapping behavior. As the user scrolls, we:
1. Keep track of which day is "anchored" (leftmost visible)
2. Dynamically load/unload day columns at the edges
3. Update `selectedDate` to match the scroll position

### Key Components

#### 1. `VirtualizedWeekView.jsx` (New)
Main container that handles:
- Horizontal scroll container with `scroll-snap-type: x mandatory`
- Day column rendering with `scroll-snap-align: start`
- Scroll event handling and day detection
- Gesture detection (trackpad vs mouse)

```jsx
// Conceptual structure
<div className="overflow-x-auto scroll-snap-x-mandatory">
  <div className="flex" style={{ width: `${totalDays * DAY_WIDTH}px` }}>
    {visibleDays.map(day => (
      <DayColumn key={day.toISOString()} date={day} />
    ))}
  </div>
</div>
```

#### 2. `DayColumn.jsx` (New)
Individual day column component:
- Fixed width (calculated based on viewport / 7)
- Contains events for that specific day
- Handles its own event positioning (vertical only)
- `scroll-snap-align: start` for snapping

#### 3. `useInfiniteScroll.js` (New Hook)
Manages the infinite scroll logic:
- Tracks scroll position and velocity
- Determines visible day range
- Handles day snapping after scroll ends
- Manages "virtual window" of rendered days
- Syncs `selectedDate` with scroll position

#### 4. `useScrollEventPositioning.js` (New Hook)
Calculates event positions relative to scroll:
- Events positioned absolutely within their DayColumn
- No more `left: ${(column / 7) * 100}%` calculations
- Vertical positioning remains the same (time-based)

### Data Flow

```
User scrolls horizontally
        ↓
useInfiniteScroll detects scroll position
        ↓
Calculate which days are visible
        ↓
Update visibleDays array (virtualization)
        ↓
DayColumn components render for visible days
        ↓
Events filtered per-day and positioned vertically
        ↓
On scroll end → snap to nearest day
        ↓
Update selectedDate to match anchor day
```

### Scroll Snapping Strategy

1. **CSS Scroll Snap** (Primary)
   ```css
   .scroll-container {
     scroll-snap-type: x mandatory;
     scroll-behavior: smooth;
   }
   .day-column {
     scroll-snap-align: start;
   }
   ```

2. **JavaScript Fallback** (For fine control)
   - Detect scroll end via `scrollend` event or debounced scroll
   - Calculate nearest day boundary
   - Smooth scroll to that position

### Gesture Detection

```javascript
const handleWheel = (e) => {
  // Trackpad: deltaX is significant, deltaY may also exist
  // Mouse wheel: typically only deltaY, Shift+scroll for horizontal
  
  const isHorizontalGesture = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 0.5;
  
  if (isHorizontalGesture) {
    // Allow native horizontal scroll
    // CSS scroll-snap handles the snapping
  } else {
    // Vertical scroll - let it scroll the time grid
  }
};
```

### Virtualization Strategy

Render a "window" of days around the current view:
- **Buffer**: 7 days before + 7 days after visible area
- **Total rendered**: ~21-28 days at any time
- **Recycle**: As user scrolls, remove days that exit buffer, add new ones

```javascript
const VISIBLE_DAYS = 7;  // Days visible at once
const BUFFER_DAYS = 7;   // Days to render on each side
const TOTAL_RENDERED = VISIBLE_DAYS + (BUFFER_DAYS * 2); // 21 days
```

### Event Positioning Changes

**Before (Week.jsx):**
```javascript
// Event positioned relative to 7-column grid
style.left = `${(event.start.getDay() / 7) * 100}%`;
style.width = `${100 / 7}%`;
```

**After (DayColumn.jsx):**
```javascript
// Event positioned within its day column (full width)
style.left = '2px';
style.width = 'calc(100% - 4px)';
// Overlapping events still need width calculation
```

### Drag & Drop Adaptations

1. **Drop zone detection**: Instead of calculating column from X position, detect which DayColumn the drop occurred in
2. **Drag preview**: Position relative to scroll container, not fixed grid
3. **Resize**: Vertical resize unchanged, horizontal resize (if any) needs scroll awareness

## Implementation Phases

### Phase 1: Core Scroll Infrastructure
1. Create `VirtualizedWeekView.jsx` with basic scroll container
2. Create `DayColumn.jsx` for individual day rendering
3. Implement `useInfiniteScroll.js` hook
4. Get basic horizontal scrolling working with snap

### Phase 2: Event Rendering
1. Adapt `useEventFiltering.js` for dynamic date ranges
2. Create per-day event filtering
3. Update event positioning for DayColumn context
4. Handle overlapping events within a day

### Phase 3: Interactions
1. Update drag & drop for new coordinate system
2. Update resize functionality
3. Update double-click to create event
4. Update context menu positioning

### Phase 4: Polish & Performance
1. Optimize virtualization (IntersectionObserver)
2. Add momentum/inertia to scroll feel
3. Handle edge cases (year boundaries, DST)
4. Performance profiling and optimization

### Phase 5: Header Sync
1. Sync day headers with scroll position
2. Update month/year display as user scrolls
3. Handle "Today" button to scroll to current day

## Files to Modify

| File | Changes |
|------|---------|
| `Week.jsx` | Replace with `VirtualizedWeekView` or major rewrite |
| `useEventRendering.js` | Adapt for per-day rendering |
| `useEventFiltering.js` | Dynamic date range support |
| `eventUtils.js` | Remove 7-column assumptions from `getEventStyle` |
| `positionUtils.js` | Update column calculations |
| `useDragAndDrop.js` | Scroll-aware drag/drop |
| `Calendar.jsx` | New state management for scroll position |

## New Files to Create

| File | Purpose |
|------|---------|
| `VirtualizedWeekView.jsx` | Main scroll container |
| `DayColumn.jsx` | Individual day column |
| `useInfiniteScroll.js` | Scroll management hook |
| `useScrollEventPositioning.js` | Event positioning hook |

## Risk Mitigation

1. **Performance**: Use `will-change: transform` and GPU acceleration
2. **Memory**: Strict virtualization to limit DOM nodes
3. **Compatibility**: Test on various browsers/devices
4. **Regression**: Keep old Week.jsx as fallback initially

## Success Criteria

1. Smooth two-finger horizontal scrolling
2. Snaps to nearest day boundary on scroll end
3. All existing functionality preserved (drag, drop, resize, create)
4. No performance regression
5. Works on macOS trackpad and Windows precision touchpad
