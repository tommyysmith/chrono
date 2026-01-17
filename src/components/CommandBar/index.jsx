'use client';

import { forwardRef, useImperativeHandle, useCallback, useEffect, useRef, memo } from 'react';
import { CommandBarProvider, useCommandBar, VIEW_MODES } from './CommandBarContext';
import CommandBarContainer from './CommandBarContainer';
import DefaultView from './views/DefaultView';
import TaskForm from './views/TaskForm';
import EventForm from './views/EventForm';
import GoToDateView from './views/GoToDateView';
import MultiSelectToolbar from './views/MultiSelectToolbar';

// Inner component that uses context
const CommandBarInner = forwardRef(function CommandBarInner({
  onPrevious,
  onNext,
  onToday,
  onCreateEvent,
  onUpdateEvent,
  onCreateTask,
  onUpdateTask,
  onToggleTaskCompletion,
  onDateSelect,
  onOpenSettings,
  isDraggingTask = false,
  setRepeatEditModalState,
  onShowSendUpdateModal,
  tags = [],
  onBulkComplete,
  onBulkPriorityChange,
  onBulkTagChange,
  onBulkDelete,
}, ref) {
  const {
    mode,
    setMode,
    setDragging,
    openTaskForm,
    openEventForm,
    openGoToDate,
    selectTask,
    selectAllTasks,
    clearSelection,
    selectedTaskIds,
    onSelectionChange,
    close,
  } = useCommandBar();

  // Track drag state
  const dragStartTimeRef = useRef(null);

  // Update dragging state when prop changes
  useEffect(() => {
    setDragging(isDraggingTask);
  }, [isDraggingTask, setDragging]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable ||
        e.target.closest('[contenteditable]');

      // Escape to close/clear
      if (e.key === 'Escape') {
        if (mode === VIEW_MODES.EVENT) {
          e.preventDefault();
          // Delete draft event if exists before closing
          const editingEvent = document.querySelector('[data-editing-event-id]')?.dataset?.editingEventId;
          // Trigger the discard handler in EventForm by dispatching a custom event
          window.dispatchEvent(new CustomEvent('commandbar-discard'));
          return;
        }
        if (mode !== VIEW_MODES.DEFAULT) {
          e.preventDefault();
          close();
          return;
        }
        if (selectedTaskIds.size > 0) {
          e.preventDefault();
          clearSelection();
          return;
        }
      }

      // Don't handle shortcuts while typing (except Escape above)
      if (isTyping) return;

      // Shift+T for new task
      if (e.key === 'T' && e.shiftKey && mode === VIEW_MODES.DEFAULT) {
        e.preventDefault();
        openTaskForm();
        return;
      }

      // Shift+E for new event
      if (e.key === 'E' && e.shiftKey && mode === VIEW_MODES.DEFAULT) {
        e.preventDefault();
        openEventForm();
        return;
      }

      // Shift+. for settings
      if (e.key === '>' && e.shiftKey && mode === VIEW_MODES.DEFAULT) {
        e.preventDefault();
        onOpenSettings?.();
        return;
      }

      // Enter to save (handled by forms)
      if (e.key === 'Enter' && !e.shiftKey) {
        // Let forms handle this
        return;
      }

      // Arrow keys for navigation (only in default mode)
      if (mode === VIEW_MODES.DEFAULT && selectedTaskIds.size === 0) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onPrevious?.();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNext?.();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mode, selectedTaskIds, close, clearSelection, openTaskForm, openEventForm, onOpenSettings, onPrevious, onNext]);

  // Expose imperative handle for parent components
  useImperativeHandle(ref, () => ({
    // Open for editing an event (from double-click)
    openForEdit: (event) => {
      if (!event) return;
      openEventForm(event);
    },

    // Open for editing a task
    openForTaskEdit: (task) => {
      if (!task) return;
      openTaskForm(task);
    },

    // Open with drag data (from dragging to create)
    // Can be called as openWithDragData(start, end, draftEventId) or openWithDragData(dragData)
    openWithDragData: (startOrData, end, draftEventId) => {
      let eventData;
      if (end !== undefined) {
        // Called with (start, end, draftEventId) parameters
        eventData = {
          id: draftEventId, // Include the draft event ID so we can delete it on discard
          isDraft: true,
          title: '',
          start: startOrData,
          end: end,
          allDay: false,
          isAllDay: false,
        };
      } else if (startOrData) {
        // Called with dragData object
        eventData = {
          id: startOrData.id,
          isDraft: true,
          title: '',
          start: startOrData.start,
          end: startOrData.end,
          date: startOrData.date,
          allDay: startOrData.allDay || false,
          isAllDay: startOrData.allDay || false,
        };
      } else {
        return;
      }
      openEventForm(eventData);
    },

    // Multi-select handlers
    handleTaskSelect: (taskId, event, isCurrentlySelected) => {
      selectTask(taskId, !isCurrentlySelected);
    },

    handleSelectAllTasks: (taskIds) => {
      selectAllTasks(taskIds);
    },

    handleClearSelection: () => {
      clearSelection();
    },

    // Direct clearSelection (alias for handleClearSelection)
    clearSelection: () => {
      clearSelection();
    },

    // Selection change listener
    onSelectionChange: (callback) => {
      return onSelectionChange(callback);
    },

    // Get current selection
    getSelectedTasks: () => {
      return selectedTaskIds;
    },

    // Check if in multi-select mode
    isMultiSelectMode: () => {
      return selectedTaskIds.size > 0;
    },

    // Close command bar
    close: () => {
      close();
    },
  }), [openEventForm, openTaskForm, selectTask, selectAllTasks, clearSelection, onSelectionChange, selectedTaskIds, close]);

  // Render current view based on mode
  const renderContent = () => {
    // Multi-select takes priority
    if (selectedTaskIds.size > 0) {
      return (
        <MultiSelectToolbar
          onBulkComplete={onBulkComplete}
          onBulkPriorityChange={onBulkPriorityChange}
          onBulkTagChange={onBulkTagChange}
          onBulkDelete={onBulkDelete}
          tags={tags}
        />
      );
    }

    switch (mode) {
      case VIEW_MODES.TASK:
        return (
          <TaskForm
            onCreateTask={onCreateTask}
            onUpdateTask={onUpdateTask}
            tags={tags}
          />
        );
      case VIEW_MODES.EVENT:
        return (
          <EventForm
            onCreateEvent={onCreateEvent}
            onUpdateEvent={onUpdateEvent}
            setRepeatEditModalState={setRepeatEditModalState}
            onShowSendUpdateModal={onShowSendUpdateModal}
          />
        );
      case VIEW_MODES.GO_TO_DATE:
        return (
          <GoToDateView
            onDateSelect={onDateSelect}
          />
        );
      case VIEW_MODES.DEFAULT:
      default:
        return (
          <DefaultView
            onPrevious={onPrevious}
            onNext={onNext}
            onToday={onToday}
          />
        );
    }
  };

  return (
    <CommandBarContainer>
      {renderContent()}
    </CommandBarContainer>
  );
});

// Main component with provider wrapper
const CommandBar = forwardRef(function CommandBar(props, ref) {
  const callbacks = {
    onClose: props.onClose,
    onCreateEvent: props.onCreateEvent,
    onUpdateEvent: props.onUpdateEvent,
    onCreateTask: props.onCreateTask,
    onUpdateTask: props.onUpdateTask,
  };

  return (
    <CommandBarProvider callbacks={callbacks}>
      <CommandBarInner ref={ref} {...props} />
    </CommandBarProvider>
  );
});

export default memo(CommandBar);
