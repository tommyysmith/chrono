# Task Scheduling Test Guide

## Testing the Bi-Directional Task-Calendar Integration

### Test Scenario 1: Drag Task from Sidebar to Calendar
1. **Setup**: Create a new task in the sidebar without a scheduled date
2. **Action**: Drag the task from sidebar to a specific time slot on the calendar
3. **Expected Results**:
   - Task block appears on the calendar at the dropped location
   - **NEW**: Task block displays time range (e.g., "2:30pm - 3:30pm")
   - **NEW**: Task block includes interactive checkbox
   - Original task in sidebar shows the new scheduled time
   - Only one instance of the task exists on the calendar

### Test Scenario 2: Move Task Block to Different Time
1. **Setup**: Have a task block already on the calendar
2. **Action**: Drag the task block to a different time slot
3. **Expected Results**:
   - Task block moves to new location
   - **NEW**: Time display updates to show new time range
   - Original task in sidebar updates to show new scheduled time
   - Changes persist immediately

### Test Scenario 3: **NEW** - Edit Task Schedule from TaskItem
1. **Setup**: Have a task scheduled and visible as a task block on the calendar
2. **Action**: 
   - Double-click the task in the sidebar to edit it
   - Change the scheduled date/time (e.g., move it forward one day)
   - Save the changes
3. **Expected Results**:
   - **Critical**: Task block automatically moves to the new position on the calendar
   - Time display updates to reflect new schedule
   - No duplicate task blocks remain on the calendar
   - Changes are reflected immediately without page refresh

### Test Scenario 4: **NEW** - Edit Task Block Directly
1. **Setup**: Have a task block on the calendar
2. **Action**: Double-click the task block itself
3. **Expected Results**:
   - Opens task editing flow (not event editing flow)
   - Can edit all task properties (title, notes, tags, priority, schedule)
   - **NEW**: Shows time fields (start/end time) when task is scheduled
   - **NEW**: Time fields work exactly like event time fields with dropdowns
   - Schedule changes move the task block to new position
   - Time changes update both the task block position and duration
   - Maintains task identity and properties

### Test Scenario 5: Resize Task Block Duration
1. **Setup**: Have a task block on the calendar
2. **Action**: Drag the bottom edge to extend or shorten the duration
3. **Expected Results**:
   - Task block resizes visually
   - **NEW**: Time display updates to show new end time
   - Duration change is saved to the original task
   - Changes persist after page refresh

### Test Scenario 6: Task Completion from Calendar
1. **Setup**: Have a task block on the calendar
2. **Action**: Click the checkbox in the task block
3. **Expected Results**:
   - Task is marked as completed
   - Task block disappears from calendar (since completed tasks aren't scheduled)
   - Task shows as completed in sidebar
   - Changes sync immediately

### Test Scenario 7: **NEW** - Cross-View Consistency
1. **Setup**: Have a task scheduled and visible in both sidebar and calendar
2. **Action**: Make changes from different locations:
   - Edit schedule from sidebar
   - Move task block on calendar
   - Complete task from either location
3. **Expected Results**:
   - All views stay perfectly synchronized
   - Changes in one location immediately reflect in all other locations
   - No inconsistencies or duplicate states

### Test Scenario 8: **NEW** - Task Time Field Editing
1. **Setup**: Have a task scheduled on the calendar (task block visible)
2. **Action**: 
   - Edit the task from the sidebar or by double-clicking the task block
   - Modify the start and end times using the time fields
   - Save the changes
3. **Expected Results**:
   - Time fields appear automatically when editing a scheduled task
   - Time pickers work identically to event time pickers
   - Duration calculation shows in dropdown (e.g., "2h 30m")
   - Task block updates position and size to reflect new times
   - Changes persist immediately and sync across all views

### Test Scenario 9: Recurring Task Handling
1. **Setup**: Create a recurring task and drag to calendar
2. **Action**: Move the task block to a different time
3. **Expected Results**:
   - Only affects that specific instance (not the entire series)
   - Other recurring instances remain unaffected
   - Proper handling of "single instance" scope

### Edge Cases to Test

#### Multiple Task Instances
1. Create task block on calendar
2. Try to drag the same task from sidebar again
3. **Expected**: Old task block is removed, new one appears at new location

#### Invalid Drop Areas
1. Drag task outside calendar bounds
2. **Expected**: Task returns to original position, no scheduling occurs

#### Task Deletion
1. Delete a task that has a calendar block
2. **Expected**: Calendar block automatically disappears

#### addToCalendar Toggle
1. Edit a scheduled task and disable "Add to Calendar"
2. **Expected**: Task block disappears from calendar

## Common Issues to Watch For

### Visual Issues
- ❌ Task blocks missing time displays
- ❌ Checkboxes not interactive
- ❌ Icons not appearing in bottom-right corner
- ❌ Overlapping or misaligned elements

### Functional Issues
- ❌ Double-clicking task block opens event editor instead of task editor
- ❌ Schedule changes not reflected in calendar position
- ❌ Duplicate task blocks appearing
- ❌ Changes not persisting after page refresh
- ❌ Sidebar and calendar showing different information

### Performance Issues
- ❌ Delays in updating calendar position after schedule changes
- ❌ Multiple unnecessary re-renders
- ❌ Calendar not responsive to localStorage changes

## Success Criteria

✅ **Visual Consistency**: Task blocks look and behave like events but maintain task-specific features  
✅ **Bi-directional Updates**: Changes in either location immediately reflect everywhere  
✅ **Data Integrity**: All task properties preserved through scheduling operations  
✅ **Single Source of Truth**: Only one task block per task, no duplicates  
✅ **Real-time Sync**: No page refresh required for any operation  
✅ **Proper Event Handling**: Task blocks open task editor, not event editor  
✅ **Time Field Integration**: Scheduled tasks show time fields in editing flow identical to events  

## Browser Testing

Test the scenarios above in:
- Chrome (latest)
- Safari (latest)
- Firefox (latest)
- Edge (latest)

Pay special attention to:
- Drag and drop behavior
- Event listener functionality
- LocalStorage synchronization
- Animation performance

 