'use client';

import { createContext, useContext, useReducer, useCallback, useRef } from 'react';

// View modes for the command bar
export const VIEW_MODES = {
  DEFAULT: 'default',
  TASK: 'task',
  EVENT: 'event',
  GO_TO_DATE: 'go-to-date',
  MULTI_SELECT: 'multiselect',
};

// Action types
const ACTIONS = {
  SET_MODE: 'SET_MODE',
  SET_VISIBLE: 'SET_VISIBLE',
  SET_DRAGGING: 'SET_DRAGGING',
  SET_EDITING_TASK: 'SET_EDITING_TASK',
  SET_EDITING_EVENT: 'SET_EDITING_EVENT',
  SET_SELECTED_TASKS: 'SET_SELECTED_TASKS',
  CLEAR_SELECTION: 'CLEAR_SELECTION',
  RESET: 'RESET',
};

// Initial state
const initialState = {
  mode: VIEW_MODES.DEFAULT,
  isVisible: true,
  isDragging: false,
  editingTask: null,
  editingEvent: null,
  selectedTaskIds: new Set(),
};

// Reducer for state management
function commandBarReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_MODE:
      return { ...state, mode: action.payload };
    
    case ACTIONS.SET_VISIBLE:
      return { ...state, isVisible: action.payload };
    
    case ACTIONS.SET_DRAGGING:
      return { ...state, isDragging: action.payload };
    
    case ACTIONS.SET_EDITING_TASK:
      return { 
        ...state, 
        editingTask: action.payload,
        mode: VIEW_MODES.TASK,
      };
    
    case ACTIONS.SET_EDITING_EVENT:
      return { 
        ...state, 
        editingEvent: action.payload,
        mode: VIEW_MODES.EVENT,
      };
    
    case ACTIONS.SET_SELECTED_TASKS:
      return { 
        ...state, 
        selectedTaskIds: action.payload,
        mode: action.payload.size > 0 ? VIEW_MODES.MULTI_SELECT : VIEW_MODES.DEFAULT,
      };
    
    case ACTIONS.CLEAR_SELECTION:
      // Only reset mode to DEFAULT if we're in MULTI_SELECT mode
      // Don't reset if we're in TASK or EVENT mode (editing a form)
      return { 
        ...state, 
        selectedTaskIds: new Set(),
        mode: state.mode === VIEW_MODES.MULTI_SELECT ? VIEW_MODES.DEFAULT : state.mode,
      };
    
    case ACTIONS.RESET:
      return { 
        ...initialState,
        isVisible: state.isVisible,
      };
    
    default:
      return state;
  }
}

// Context
const CommandBarContext = createContext(null);

// Provider component
export function CommandBarProvider({ children, callbacks }) {
  const [state, dispatch] = useReducer(commandBarReducer, initialState);
  
  // Store callbacks in ref to avoid re-renders
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  
  // Selection change callbacks (for external listeners)
  const selectionCallbacksRef = useRef(new Set());

  // Actions
  const setMode = useCallback((mode) => {
    dispatch({ type: ACTIONS.SET_MODE, payload: mode });
  }, []);

  const setVisible = useCallback((visible) => {
    dispatch({ type: ACTIONS.SET_VISIBLE, payload: visible });
  }, []);

  const setDragging = useCallback((dragging) => {
    dispatch({ type: ACTIONS.SET_DRAGGING, payload: dragging });
  }, []);

  const openTaskForm = useCallback((task = null) => {
    dispatch({ type: ACTIONS.SET_EDITING_TASK, payload: task });
  }, []);

  const openEventForm = useCallback((event = null) => {
    dispatch({ type: ACTIONS.SET_EDITING_EVENT, payload: event });
  }, []);

  const openGoToDate = useCallback(() => {
    dispatch({ type: ACTIONS.SET_MODE, payload: VIEW_MODES.GO_TO_DATE });
  }, []);

  const selectTask = useCallback((taskId, isSelected) => {
    dispatch({ 
      type: ACTIONS.SET_SELECTED_TASKS, 
      payload: new Set(
        isSelected 
          ? [...state.selectedTaskIds, taskId]
          : [...state.selectedTaskIds].filter(id => id !== taskId)
      )
    });
    // Notify external listeners
    selectionCallbacksRef.current.forEach(cb => {
      try { cb([...state.selectedTaskIds]); } catch (e) { console.error(e); }
    });
  }, [state.selectedTaskIds]);

  const selectAllTasks = useCallback((taskIds) => {
    const newSet = new Set(taskIds);
    dispatch({ type: ACTIONS.SET_SELECTED_TASKS, payload: newSet });
    selectionCallbacksRef.current.forEach(cb => {
      try { cb(taskIds); } catch (e) { console.error(e); }
    });
  }, []);

  const clearSelection = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_SELECTION });
    selectionCallbacksRef.current.forEach(cb => {
      try { cb([]); } catch (e) { console.error(e); }
    });
  }, []);

  const close = useCallback(() => {
    dispatch({ type: ACTIONS.RESET });
    callbacksRef.current?.onClose?.();
  }, []);

  const onSelectionChange = useCallback((callback) => {
    selectionCallbacksRef.current.add(callback);
    return () => selectionCallbacksRef.current.delete(callback);
  }, []);

  const value = {
    // State
    ...state,
    
    // Computed
    isExpanded: state.mode !== VIEW_MODES.DEFAULT || state.selectedTaskIds.size > 0,
    shouldShow: state.isVisible && !state.isDragging,
    
    // Actions
    setMode,
    setVisible,
    setDragging,
    openTaskForm,
    openEventForm,
    openGoToDate,
    selectTask,
    selectAllTasks,
    clearSelection,
    close,
    onSelectionChange,
    
    // Callbacks ref for child components
    callbacks: callbacksRef,
  };

  return (
    <CommandBarContext.Provider value={value}>
      {children}
    </CommandBarContext.Provider>
  );
}

// Hook to use context
export function useCommandBar() {
  const context = useContext(CommandBarContext);
  if (!context) {
    throw new Error('useCommandBar must be used within CommandBarProvider');
  }
  return context;
}

export default CommandBarContext;
