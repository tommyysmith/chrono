// Optimized task state management with batched updates and deferred localStorage
import { useState, useCallback, useRef, useEffect, startTransition } from 'react';

// Batch multiple updates together to reduce re-renders
class TaskUpdateBatcher {
  constructor() {
    this.pendingUpdates = new Map();
    this.batchTimeout = null;
    this.listeners = new Set();
  }

  scheduleUpdate(taskId, updates) {
    // Merge updates for the same task
    if (this.pendingUpdates.has(taskId)) {
      this.pendingUpdates.set(taskId, {
        ...this.pendingUpdates.get(taskId),
        ...updates
      });
    } else {
      this.pendingUpdates.set(taskId, updates);
    }

    // Debounce the batch flush
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Flush immediately for critical updates (like completion), but batch storage writes
    this.batchTimeout = setTimeout(() => {
      this.flush();
    }, 0);
  }

  flush() {
    if (this.pendingUpdates.size === 0) return;

    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();

    // Notify all listeners with batched updates
    this.listeners.forEach(listener => listener(updates));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Singleton batcher instance
const taskBatcher = new TaskUpdateBatcher();

// Optimize localStorage operations - write in idle time
const deferredLocalStorage = {
  pendingWrites: new Map(),
  writeTimeout: null,

  set(key, value) {
    this.pendingWrites.set(key, value);
    
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }

    // Use requestIdleCallback for non-blocking writes
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => this.flush(), { timeout: 100 });
    } else {
      this.writeTimeout = setTimeout(() => this.flush(), 50);
    }
  },

  flush() {
    this.pendingWrites.forEach((value, key) => {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('Error writing to localStorage:', error);
      }
    });
    this.pendingWrites.clear();
  },

  get(key) {
    // Check pending writes first
    if (this.pendingWrites.has(key)) {
      return this.pendingWrites.get(key);
    }
    return localStorage.getItem(key);
  }
};

export const useOptimizedTaskState = () => {
  const [tasks, setTasks] = useState(() => {
    try {
      const saved = localStorage.getItem('tasks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const tasksRef = useRef(tasks);
  const updateQueueRef = useRef([]);

  // Keep ref in sync with state
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Subscribe to batched updates
  useEffect(() => {
    const unsubscribe = taskBatcher.subscribe((updates) => {
      startTransition(() => {
        setTasks(prevTasks => {
          const newTasks = { ...prevTasks };
          let hasChanges = false;

          updates.forEach((taskUpdates, taskId) => {
            // Apply updates to all collections
            Object.keys(newTasks).forEach(collection => {
              if (Array.isArray(newTasks[collection])) {
                const index = newTasks[collection].findIndex(t => t.id === taskId);
                if (index !== -1) {
                  newTasks[collection] = [...newTasks[collection]];
                  newTasks[collection][index] = {
                    ...newTasks[collection][index],
                    ...taskUpdates
                  };
                  hasChanges = true;
                }
              }
            });
          });

          if (hasChanges) {
            // Defer localStorage write
            deferredLocalStorage.set('tasks', JSON.stringify(newTasks));
          }

          return hasChanges ? newTasks : prevTasks;
        });
      });
    });

    return unsubscribe;
  }, []);

  // Optimized task update that batches changes
  const updateTask = useCallback((taskId, updates) => {
    // Immediately update the ref for synchronous reads
    const currentTasks = tasksRef.current;
    const updatedTasks = { ...currentTasks };
    
    Object.keys(updatedTasks).forEach(collection => {
      if (Array.isArray(updatedTasks[collection])) {
        const index = updatedTasks[collection].findIndex(t => t.id === taskId);
        if (index !== -1) {
          updatedTasks[collection] = [...updatedTasks[collection]];
          updatedTasks[collection][index] = {
            ...updatedTasks[collection][index],
            ...updates
          };
        }
      }
    });
    
    tasksRef.current = updatedTasks;

    // Schedule batched state update
    taskBatcher.scheduleUpdate(taskId, updates);
  }, []);

  // Get current tasks (from ref for immediate reads)
  const getCurrentTasks = useCallback(() => {
    return tasksRef.current;
  }, []);

  return {
    tasks,
    updateTask,
    getCurrentTasks,
    setTasks
  };
};

export { deferredLocalStorage };

