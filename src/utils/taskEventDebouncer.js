// Debounced task event dispatcher to prevent event storms and improve INP
class TaskEventDebouncer {
  constructor() {
    this.pending = null;
    this.timeout = null;
    this.rafId = null;
  }

  /**
   * Schedule a task update event with debouncing
   * @param {Object} tasks - The updated tasks object
   * @param {string} type - Type of update ('completion', 'update', 'create', 'delete')
   */
  scheduleUpdate(tasks, type = 'update') {
    // Cancel any pending updates
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }

    // Store the pending update
    this.pending = { tasks, type, timestamp: Date.now() };

    // For completion events, dispatch immediately for UI responsiveness
    if (type === 'completion') {
      this.flush();
    } else {
      // Debounce other updates slightly
      this.timeout = setTimeout(() => this.flush(), 16); // ~1 frame
    }
  }

  flush() {
    if (!this.pending) return;

    const { tasks, type } = this.pending;
    this.pending = null;

    // Write to localStorage in background
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => {
        try {
          localStorage.setItem('tasks', JSON.stringify(tasks));
        } catch (error) {
          console.error('Error writing tasks to localStorage:', error);
        }
      }, { timeout: 100 });
    } else {
      setTimeout(() => {
        try {
          localStorage.setItem('tasks', JSON.stringify(tasks));
        } catch (error) {
          console.error('Error writing tasks to localStorage:', error);
        }
      }, 0);
    }

    // Dispatch single consolidated event in next frame
    this.rafId = requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks, type },
        bubbles: false // Don't bubble - reduce event propagation cost
      }));
    });
  }

  // Force immediate flush (for critical updates)
  flushSync() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.flush();
  }
}

// Singleton instance
const taskEventDebouncer = new TaskEventDebouncer();

export default taskEventDebouncer;

