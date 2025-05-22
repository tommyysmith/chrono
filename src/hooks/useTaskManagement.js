import { generateRecurringTasks, generateNextDisplayableTaskInstance } from '../utils/recurrenceUtils';
import { useEffect, useCallback } from 'react'; // Added useCallback
import { isToday, parseISO } from 'date-fns'; // Import date-fns functions

export function useTaskManagement() {
  /**
   * Get all tasks in a series
   * @param {Array} allTasks - All tasks
   * @param {string} seriesId - The series ID to filter by
   * @returns {Array} Tasks in the series
   */
  const getTasksInSeries = useCallback((allTasks, seriesId) => {
    if (!seriesId) return [];
    return allTasks.filter(task => task.seriesId === seriesId);
  }, []);

  const handleCreateTask = useCallback((task) => {
    console.log('handleCreateTask called with task:', task);
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      console.log('Current tasks from localStorage:', tasks);

      const newTask = { ...task, createdAt: new Date().toISOString() };
      console.log('Task with createdAt:', newTask);
      
      // Ensure basic collections exist
      if (!tasks.all) tasks.all = [];
      if (!tasks.today) tasks.today = [];
      let tagGroup = newTask.tag ? newTask.tag.id : "all";
      if (!tasks[tagGroup]) tasks[tagGroup] = [];

      // Generate seriesId for new base recurring tasks
      if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat && !newTask.seriesId) {
        newTask.seriesId = `series_${Date.now().toString()}_${Math.random().toString(36).substring(2, 9)}`;
        console.log('Generated seriesId for new recurring task:', newTask.seriesId);
        // Ensure startDateOfSeries is set for rrule generation for the base task
        if (!newTask.startDateOfSeries && newTask.scheduledDate) {
            newTask.startDateOfSeries = newTask.scheduledDate;
        } else if (!newTask.startDateOfSeries && !newTask.scheduledDate) { // If no scheduledDate, use createdAt
            newTask.startDateOfSeries = newTask.createdAt; 
            newTask.scheduledDate = newTask.createdAt; // Also set scheduledDate for consistency if not present
            console.log('Set startDateOfSeries and scheduledDate from createdAt for base recurring task');
        } else if (!newTask.startDateOfSeries) {
            newTask.startDateOfSeries = newTask.createdAt;
        }
        console.log('Base recurring task definition:', newTask);
      }

      // Add/Update the newTask (which could be a base definition or a single task/instance) to 'all' and its tag group
      // Remove existing task if it's an update to prevent duplicates, before adding the new/updated one.
      tasks.all = tasks.all.filter(t => t.id !== newTask.id);
      tasks.all.push(newTask);

      if (tagGroup !== "all") {
        tasks[tagGroup] = tasks[tagGroup].filter(t => t.id !== newTask.id);
        tasks[tagGroup].push(newTask);
      }
      console.log('Added/Updated base task definition to collections:', { id: newTask.id, tagGroup });
      
      // If it's a new base recurring task, generate and add all its instances
      if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat) {
        console.log('Generating all instances for new base recurring task:', newTask.id);
        // Ensure baseTask has a scheduledDate for RRule dtstart if not already set
        const baseTaskForRRule = { ...newTask }; 
        if (!baseTaskForRRule.scheduledDate) {
            baseTaskForRRule.scheduledDate = baseTaskForRRule.startDateOfSeries || baseTaskForRRule.createdAt || new Date().toISOString();
            console.log('Ensured baseTaskForRRule.scheduledDate for RRule generation:', baseTaskForRRule.scheduledDate);
        }

        const instances = generateRecurringTasks(baseTaskForRRule); 
        console.log(`Generated ${instances.length} instances for task ${newTask.id}:`, instances);

        if (instances && instances.length > 0) {
          instances.forEach(instance => {
            // Add instance to 'all' if not already present (should be new IDs)
            if (!tasks.all.some(t => t.id === instance.id)) {
              tasks.all.push(instance);
            }
            // Add instance to its tag group
            const instanceTagGroup = instance.tag ? instance.tag.id : "all";
            if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
            if (instanceTagGroup !== "all" && !tasks[instanceTagGroup].some(t => t.id === instance.id)) {
              tasks[instanceTagGroup].push(instance);
            }
            // Add instance to 'today' collection if scheduled for today
            if (instance.scheduledDate && isToday(parseISO(instance.scheduledDate))) {
              if (!tasks.today.some(t => t.id === instance.id)) {
                tasks.today.push(instance);
                console.log('Added instance to today collection:', instance);
              }
            }
          });
        }
      } else if (newTask.scheduledDate && isToday(parseISO(newTask.scheduledDate))) {
        // If it's a non-recurring task OR a single existing instance being updated, and scheduled for today
        // Ensure it's in the 'today' array (handles cases where a task is moved to today)
        tasks.today = tasks.today.filter(t => t.id !== newTask.id); // Remove if present to re-add (updates position or ensures no dupes)
        tasks.today.push(newTask);
        console.log('Added/Updated single task/instance to today collection:', newTask);
      }
      
      // Save all changes (base task + all instances) to localStorage in one go
      localStorage.setItem("tasks", JSON.stringify(tasks));
      console.log('Saved tasks (base and/or instances) to localStorage');

      // Dispatch events to ensure UI updates immediately
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: tasks } // Send the fully updated tasks object
      }));

    } catch (error) {
      console.error('Error in handleCreateTask:', error);
    }
  }, []);

  const handleUpdateTask = useCallback((updatedTaskData) => {
    console.log('handleUpdateTask called with:', updatedTaskData);
    
    if (!updatedTaskData) {
      console.error('Invalid task data provided for update: null or undefined');
      return false;
    }
    
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      let originalTask = null;
      let originalTagId = null;
      let newTagId = updatedTaskData.tag ? updatedTaskData.tag.id : null;
      
      // Ensure basic collections exist
      if (!tasks.all) tasks.all = [];
      if (!tasks.today) tasks.today = [];
      if (newTagId && !tasks[newTagId]) tasks[newTagId] = [];
      
      console.log('Current tasks from localStorage:', tasks);
      
      // Check if this is a new task being created
      const isNewTask = !updatedTaskData.id || 
                        !tasks.all.some(t => t.id === updatedTaskData.id);
      
      // If it's a new task, generate an ID and handle it as a creation
      if (isNewTask) {
        console.log('This appears to be a new task creation rather than an update');
        
        // Generate an ID if one doesn't exist
        const newTask = {
          ...updatedTaskData,
          id: updatedTaskData.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          createdAt: new Date().toISOString()
        };
        
        // If it's a recurring task, ensure it has a seriesId
        if (newTask.repeat && newTask.repeat !== 'none' && !newTask.seriesId) {
          newTask.seriesId = `series_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          console.log('Generated seriesId for new recurring task:', newTask.seriesId);
          
          // Ensure startDateOfSeries is set for rrule generation
          if (!newTask.startDateOfSeries && newTask.scheduledDate) {
            newTask.startDateOfSeries = newTask.scheduledDate;
          } else if (!newTask.startDateOfSeries) {
            newTask.startDateOfSeries = newTask.createdAt;
            if (!newTask.scheduledDate) {
              newTask.scheduledDate = newTask.createdAt; // Also set scheduledDate for consistency
            }
          }
          
          // For base recurring tasks, explicitly set isRepeat to false
          if (typeof newTask.isRepeat === 'undefined') {
            newTask.isRepeat = false;
          }
          
          console.log('Prepared new recurring task:', newTask);
        }
        
        // Add to collections
        tasks.all.push(newTask);
        if (newTagId) {
          tasks[newTagId].push(newTask);
        }
        
        // If scheduled for today, add to today collection
        if (newTask.scheduledDate && isToday(parseISO(newTask.scheduledDate))) {
          tasks.today.push(newTask);
        }
        
        // Generate instances for recurring tasks
        if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat) {
          console.log('Generating instances for new recurring task');
          const instances = generateRecurringTasks(newTask);
          
          if (instances && instances.length > 0) {
            console.log(`Generated ${instances.length} instances for new recurring task`);
            instances.forEach(instance => {
              // Add to all collection if not already there
              if (!tasks.all.some(t => t.id === instance.id)) {
                tasks.all.push(instance);
              }
              
              // Add to tag collection
              const instanceTagId = instance.tag ? instance.tag.id : null;
              if (instanceTagId && !tasks[instanceTagId].some(t => t.id === instance.id)) {
                if (!tasks[instanceTagId]) tasks[instanceTagId] = [];
                tasks[instanceTagId].push(instance);
              }
              
              // Add to today if applicable
              if (instance.scheduledDate && isToday(parseISO(instance.scheduledDate)) && 
                  !tasks.today.some(t => t.id === instance.id)) {
                tasks.today.push(instance);
              }
            });
          }
        }
        
        // Save to localStorage
        localStorage.setItem("tasks", JSON.stringify(tasks));
        
        // Dispatch events
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'tasks',
          newValue: JSON.stringify(tasks),
          url: window.location.href
        }));
        
        window.dispatchEvent(new CustomEvent('tasksUpdated', {
          detail: tasks
        }));
        
        return true;
      }
      
      // If we're here, it's an update to an existing task
      console.log('Looking for task with ID:', updatedTaskData.id);
      
      // First, find and store the original task for reference
      for (const groupKey in tasks) {
        if (Array.isArray(tasks[groupKey])) {
          const foundTask = tasks[groupKey].find(t => t.id === updatedTaskData.id);
          if (foundTask && !originalTask) {
            originalTask = { ...foundTask };
            if (originalTask.tag) {
              originalTagId = originalTask.tag.id;
            }
            console.log(`Found task in '${groupKey}' collection:`, originalTask);
            break;
          }
        }
      }
      
      if (!originalTask) {
        console.error("Task not found for update:", updatedTaskData.id);
        
        // If this is a recurring task instance, we might need to create it first
        if (updatedTaskData.seriesId && updatedTaskData.isRepeat) {
          console.log('This appears to be a recurring task instance. Attempting to create it first.');
          
          // Find the base task definition
          let baseTask = null;
          for (const groupKey in tasks) {
            if (Array.isArray(tasks[groupKey])) {
              const found = tasks[groupKey].find(t => 
                t.seriesId === updatedTaskData.seriesId && 
                (t.isRepeat === false || typeof t.isRepeat === 'undefined')
              );
              if (found) {
                baseTask = found;
                break;
              }
            }
          }
          
          if (baseTask) {
            console.log('Found base task definition:', baseTask);
            // Create a new instance based on the updated task data
            const newInstance = {
              ...updatedTaskData,
              createdAt: new Date().toISOString()
            };
            
            // Add the new instance to collections
            const instanceTagGroup = newInstance.tag ? newInstance.tag.id : "all";
            if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
            if (!tasks.all) tasks.all = [];
            
            tasks[instanceTagGroup].push(newInstance);
            tasks.all.push(newInstance);
            
            // Set originalTask to this new instance
            originalTask = newInstance;
            if (originalTask.tag) {
              originalTagId = originalTask.tag.id;
            }
            
            console.log('Created missing task instance:', newInstance);
          } else {
            console.error('Could not find base task definition for series:', updatedTaskData.seriesId);
            return false;
          }
        } else {
          return false;
        }
      }
      
      console.log('Original task:', originalTask, 'Original tag ID:', originalTagId, 'New tag ID:', newTagId);
      
      // Create the updated task by merging original with updates
      const mergedTask = { ...originalTask, ...updatedTaskData };
      console.log('Merged task after update:', mergedTask);
      
      // Handle tag changes - we need to move the task between collections
      if (originalTagId !== newTagId) {
        console.log('Tag has changed, moving task between collections');
        
        // Remove the task from all collections except 'all'
        for (const groupKey in tasks) {
          if (groupKey !== 'all' && Array.isArray(tasks[groupKey])) {
            tasks[groupKey] = tasks[groupKey].filter(t => t.id !== updatedTaskData.id);
          }
        }
        
        // Add to new tag collection if it has a new tag
        if (newTagId) {
          if (!tasks[newTagId]) tasks[newTagId] = [];
          tasks[newTagId].push(mergedTask);
          console.log(`Added task to new tag collection: ${newTagId}`);
        }
      }
      
      // Update the task in the 'all' collection
      const allTaskIndex = tasks.all ? tasks.all.findIndex(t => t.id === updatedTaskData.id) : -1;
      if (allTaskIndex !== -1) {
        tasks.all[allTaskIndex] = mergedTask;
        console.log('Updated task in all collection');
      } else if (tasks.all) {
        tasks.all.push(mergedTask);
        console.log('Added task to all collection');
      } else {
        tasks.all = [mergedTask];
        console.log('Created all collection with task');
      }
      
      // Handle recurring task updates
      if (mergedTask.repeat && mergedTask.repeat !== 'none') {
        console.log('Updating a recurring task');
        
        // Ensure the task has a seriesId
        if (!mergedTask.seriesId) {
          mergedTask.seriesId = `series_${Date.now().toString()}_${Math.random().toString(36).substring(2, 9)}`;
          console.log('Added missing seriesId to task:', mergedTask.seriesId);
        }
        
        // Ensure the task has a startDateOfSeries
        if (!mergedTask.startDateOfSeries) {
          mergedTask.startDateOfSeries = mergedTask.scheduledDate || mergedTask.createdAt;
          console.log('Set startDateOfSeries to:', mergedTask.startDateOfSeries);
        }
        
        // If this is a base task (not an instance), update all instances
        if (!mergedTask.isRepeat) {
          console.log('This is a base recurring task, updating instances');
          
          // Find all instances of this series
          let instances = [];
          for (const groupKey in tasks) {
            if (Array.isArray(tasks[groupKey])) {
              const groupInstances = tasks[groupKey].filter(t => 
                t.seriesId === mergedTask.seriesId && 
                t.isRepeat === true && 
                t.id !== mergedTask.id
              );
              instances = [...instances, ...groupInstances];
            }
          }
          
          console.log(`Found ${instances.length} instances of this series`);
          
          // Update tag on all instances if tag has changed
          if (originalTagId !== newTagId && instances.length > 0) {
            console.log('Updating tag on all instances');
            
            // Remove instances from old tag collection
            if (originalTagId && tasks[originalTagId]){
                tasks[originalTagId] = tasks[originalTagId].filter(t => 
                  !(t.seriesId === mergedTask.seriesId && t.isRepeat === true)
                );
            }
            
            // Update instances in all collection
            if (tasks.all) {
              tasks.all.forEach(task => {
                if (task.seriesId === mergedTask.seriesId && task.isRepeat === true) {
                  task.tag = mergedTask.tag;
                }
              });
            }
            
            // Add instances to new tag collection
            if (newTagId) {
              if (!tasks[newTagId]) tasks[newTagId] = [];
              instances.forEach(instance => {
                const updatedInstance = { ...instance, tag: mergedTask.tag };
                tasks[newTagId].push(updatedInstance);
              });
            }
          }
          
          // Regenerate the next active instance if needed
          const hasActiveInstance = Object.values(tasks)
            .filter(Array.isArray)
            .some(group => 
              group.some(t => 
                t.seriesId === mergedTask.seriesId && 
                t.isRepeat === true && 
                !t.completed
              )
            );
          
          if (!hasActiveInstance) {
            console.log('No active instance found, generating a new one');
            const nextInstance = generateNextDisplayableTaskInstance(mergedTask, null);
            
            if (nextInstance) {
              console.log('Generated new instance:', nextInstance);
              const instanceTagGroup = nextInstance.tag ? nextInstance.tag.id : "all";
              if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
              if (!tasks.all.find(t => t.id === nextInstance.id)) {
                tasks.all.push(nextInstance);
              }
            }
          }
        }
        // If this is an instance being updated, ensure the base task reflects the changes
        else if (mergedTask.isRepeat === true && mergedTask.originalBaseId) {
          console.log('This is a recurring instance, updating base task if needed');
          
          // Find the base task
          const baseTask = tasks.all.find(t => t.id === mergedTask.originalBaseId);
          if (baseTask && newTagId !== null && originalTagId !== newTagId) {
            console.log('Updating tag on base task');
            baseTask.tag = mergedTask.tag;
            
            // Update base task in its tag collection
            if (baseTask.tag && baseTask.tag.id) {
              const baseTagId = baseTask.tag.id;
              if (!tasks[baseTagId]) tasks[baseTagId] = [];
              
              // Remove from old tag collection
              if (originalTagId && tasks[originalTagId]) {
                tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== baseTask.id);
              }
              
              // Add to new tag collection if not already there
              if (!tasks[baseTagId].find(t => t.id === baseTask.id)) {
                tasks[baseTagId].push(baseTask);
              }
            }
          }
        }
      }
      
      console.log('Saving updated tasks to localStorage');
      localStorage.setItem("tasks", JSON.stringify(tasks));
      
      // Dispatch events to ensure UI updates
      console.log('Dispatching storage event for task update');
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      
      return true;
    } catch (error) {
      console.error('Error in handleUpdateTask:', error);
      return false;
    }
  }, []);

  const handleToggleTaskCompletion = useCallback((taskIdOrObject, scope = 'single') => {
    console.log('[handleToggleTaskCompletion] Initiated with:', 
      typeof taskIdOrObject === 'object' ? JSON.parse(JSON.stringify(taskIdOrObject)) : taskIdOrObject, 
      'Scope:', scope
    );
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      
      // Ensure basic collections exist
      if (!tasks.all) tasks.all = [];
      if (!tasks.today) tasks.today = [];
      if (!tasks.completed) tasks.completed = [];
      
      let taskId;
      let taskToToggle = null;
      let seriesId = null;
      let isRecurringInstance = false;
      let newCompletionState = false;
      let baseTask = null;

      if (typeof taskIdOrObject === 'object' && taskIdOrObject !== null) {
        taskToToggle = { ...taskIdOrObject }; // Clone the task object
        taskId = taskToToggle.id;
        isRecurringInstance = !!taskToToggle.isRepeat;
        seriesId = taskToToggle.seriesId;
        newCompletionState = !taskToToggle.completed;
        console.log('[handleToggleTaskCompletion] Received task object:', 
          { id: taskId, title: taskToToggle.title, isRepeat: isRecurringInstance, seriesId: seriesId, originalBaseId: taskToToggle.originalBaseId, completed: taskToToggle.completed }
        );

        // Data recovery for object: If it's a repeat task but seriesId is missing, try to get it from base task via originalBaseId
        if (isRecurringInstance && !seriesId && taskToToggle.originalBaseId) {
          console.warn(`[handleToggleTaskCompletion] Object: Recurring instance ${taskId} is missing seriesId. Attempting recovery via originalBaseId: ${taskToToggle.originalBaseId}`);
          baseTask = tasks.all.find(t => t.id === taskToToggle.originalBaseId && (t.isRepeat === false || typeof t.isRepeat === 'undefined'));
          if (baseTask && baseTask.seriesId) {
            taskToToggle.seriesId = baseTask.seriesId;
            seriesId = baseTask.seriesId; // Update local variable too
            console.log(`[handleToggleTaskCompletion] Object: Successfully recovered seriesId: ${seriesId} for task ${taskId}`);
          } else {
            console.error(`[handleToggleTaskCompletion] Object: Could not recover seriesId for ${taskId} using originalBaseId ${taskToToggle.originalBaseId}. Base task for recovery:`, baseTask);
          }
        } else if (isRecurringInstance && !seriesId && !taskToToggle.originalBaseId) {
          console.error(`[handleToggleTaskCompletion] CRITICAL (Object): Recurring instance ${taskId} is missing BOTH seriesId and originalBaseId. Cannot reliably find base task.`);
        }
      } else if (typeof taskIdOrObject === 'string') {
        taskId = taskIdOrObject;
        // Check if it's a recurring instance ID (e.g., "seriesId_repeat_timestamp")
        const match = taskId.match(/^(series_.*?)_repeat_(\d+)$/);
        if (match) {
          isRecurringInstance = true;
          seriesId = match[1]; // This is the extracted seriesId
          newCompletionState = true; // Default to completing if it's a new instance being created on-the-fly
          console.log('[handleToggleTaskCompletion] Identified recurring instance from ID string:', { taskId, seriesId, isRecurringInstance });
        } else {
          console.log('[handleToggleTaskCompletion] ID string does not match recurring instance pattern:', taskId);
          // It might be a regular task ID, isRecurringInstance remains false, seriesId remains null
        }
      } else {
        console.error('[handleToggleTaskCompletion] Invalid taskIdOrObject type:', taskIdOrObject);
        return false;
      }

      // If we have a task object (either passed in or to be found by ID), try to use it or find it.
      // If taskToToggle is already populated, it means an object was passed in.
      // If not, and taskId is available, try to find it in localStorage.
      if (!taskToToggle && taskId) {
        console.log('[handleToggleTaskCompletion] Task object not passed directly or string ID provided. Looking for task in localStorage with ID:', taskId);
        for (const groupKey in tasks) {
          if (Array.isArray(tasks[groupKey])) {
            const taskIndex = tasks[groupKey].findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
              taskToToggle = { ...tasks[groupKey][taskIndex] }; // Clone the task
              isRecurringInstance = !!taskToToggle.isRepeat;
              seriesId = taskToToggle.seriesId; // Get seriesId from the found task
              newCompletionState = !taskToToggle.completed;
              console.log('[handleToggleTaskCompletion] Found task to toggle in localStorage:', 
                { id: taskToToggle.id, title: taskToToggle.title, isRepeat: taskToToggle.isRepeat, seriesId: taskToToggle.seriesId, completed: taskToToggle.completed }
              );

              // Data recovery: If it's a repeat task but seriesId is missing, try to get it from base task via originalBaseId
              if (taskToToggle.isRepeat && !taskToToggle.seriesId && taskToToggle.originalBaseId) {
                console.warn(`[handleToggleTaskCompletion] Recurring instance ${taskToToggle.id} is missing seriesId. Attempting recovery via originalBaseId: ${taskToToggle.originalBaseId}`);
                const baseTaskForRecovery = tasks.all.find(t => t.id === taskToToggle.originalBaseId && (t.isRepeat === false || typeof t.isRepeat === 'undefined'));
                if (baseTaskForRecovery && baseTaskForRecovery.seriesId) {
                  taskToToggle.seriesId = baseTaskForRecovery.seriesId;
                  seriesId = baseTaskForRecovery.seriesId; // Update local variable too
                  console.log(`[handleToggleTaskCompletion] Successfully recovered seriesId: ${seriesId} for task ${taskToToggle.id}`);
                } else {
                  console.error(`[handleToggleTaskCompletion] Could not find base task or seriesId for recovery for instance ${taskToToggle.id} using originalBaseId ${taskToToggle.originalBaseId}`);
                }
              }
              break; // Found it, no need to continue searching
            }
          }
        }
      }

      // If we still don't have a task (e.g. string ID didn't match localStorage), try to handle it as a recurring instance
      if (!taskToToggle) {
        console.log("[handleToggleTaskCompletion] Task not found in localStorage by ID, or initial input was a string ID for a new instance. Checking if it's a recurring instance that needs creation.");
        if (isRecurringInstance && seriesId) { // seriesId would have been extracted from string ID or recovered
          console.log(`[handleToggleTaskCompletion] Attempting to find base task for seriesId: '${seriesId}' (derived from string ID or recovered).`);
          console.log('[handleToggleTaskCompletion] tasks.all available for base task lookup:', 
            JSON.parse(JSON.stringify(tasks.all.filter(t => t.seriesId || (t.isRepeat === false || typeof t.isRepeat === 'undefined')).map(t => ({id: t.id, seriesId: t.seriesId, isRepeat: t.isRepeat, title: t.title, repeat: t.repeat }))))
          );

          baseTask = tasks.all.find(
            (t) => t.seriesId === seriesId && (t.isRepeat === false || typeof t.isRepeat === 'undefined')
          );
          console.log('[handleToggleTaskCompletion] Found base task for seriesId:', baseTask ? { id: baseTask.id, title: baseTask.title, isRepeat: baseTask.isRepeat } : null);

          if (!baseTask) {
            console.error(`[handleToggleTaskCompletion] CRITICAL: Could not find base task for seriesId: '${seriesId}'. This is likely the root cause of 'Task not found' error.`);
            const potentialBaseTasks = tasks.all.filter(t => (t.isRepeat === false || typeof t.isRepeat === 'undefined') && t.repeat && t.repeat !== 'none');
            console.log('[handleToggleTaskCompletion] All potential base tasks in tasks.all (isRepeat=false/undefined and has repeat rule):', 
              JSON.parse(JSON.stringify(potentialBaseTasks.map(t => ({id: t.id, seriesId: t.seriesId, title: t.title, repeat: t.repeat})))));
            const similarSeriesIdTasks = tasks.all.filter(t => t.seriesId && seriesId && (t.seriesId.includes(seriesId) || seriesId.includes(t.seriesId)));
            console.log('[handleToggleTaskCompletion] Tasks with seriesIds similar to target:', 
              JSON.parse(JSON.stringify(similarSeriesIdTasks.map(t => ({id: t.id, seriesId: t.seriesId, isRepeat: t.isRepeat, title: t.title})))));
          } else {
            console.log('[handleToggleTaskCompletion] Successfully found base task for on-the-fly instance creation:', 
              {id: baseTask.id, seriesId: baseTask.seriesId, title: baseTask.title}
            );
          }
          
          // If baseTask found, proceed to create the instance object (taskToToggle)
          if (baseTask) {
            // Create a new instance based on the updated task data
            let newInstance;
            
            if (typeof taskIdOrObject === 'object') {
              // If we have a task object, use its properties
              newInstance = {
                ...baseTask, // Start with base task properties
                ...taskIdOrObject, // Override with provided properties
                id: taskId, // Ensure ID is consistent
                isRepeat: true,
                seriesId: seriesId,
                createdAt: new Date().toISOString(),
                completed: !taskIdOrObject.completed // Toggle the completion state
              };
            } else {
              // If we only have an ID, create a minimal instance
              newInstance = {
                ...baseTask,
                id: taskId,
                isRepeat: true,
                seriesId: seriesId,
                createdAt: new Date().toISOString(),
                completed: true // Default to completing the task
              };
            }
            
            newCompletionState = newInstance.completed;
            
            // Add the new instance to collections
            const instanceTagGroup = newInstance.tag ? newInstance.tag.id : "all";
            if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
            
            // Remove any existing instance with the same ID to avoid duplicates
            tasks[instanceTagGroup] = tasks[instanceTagGroup].filter(t => t.id !== taskId);
            tasks.all = tasks.all.filter(t => t.id !== taskId);
            
            // Add the new instance
            tasks[instanceTagGroup].push(newInstance);
            tasks.all.push(newInstance);
            
            // Set taskToToggle to this new instance
            taskToToggle = newInstance;
            
            console.log('Created and toggled recurring task instance:', newInstance);
          } else {
            console.error('Could not find base task definition for series:', seriesId);
            return false;
          }
        } else {
          console.error("Task not found for completion toggle:", taskId);
          return false;
        }
      }
      
      console.log('Original task:', taskToToggle, 'Original tag ID:', taskToToggle.tag ? taskToToggle.tag.id : null, 'New tag ID:', taskToToggle.tag ? taskToToggle.tag.id : null);
      
      // Update the task's completion state IN PLACE in all collections where it exists
      for (const groupKey in tasks) {
        if (Array.isArray(tasks[groupKey])) {
          tasks[groupKey] = tasks[groupKey].map(t => {
            if (t.id === taskId) {
              const updatedInstance = { ...t, completed: newCompletionState };
              if (newCompletionState) {
                updatedInstance.completedAt = new Date().toISOString();
              } else {
                delete updatedInstance.completedAt;
              }
              return updatedInstance;
            }
            return t;
          });
        }
      }

      // If task is being marked as completed, move it to the 'completed' collection
      // and remove from other active collections (like 'today', tag groups, but not 'all')
      if (newCompletionState) {
        console.log('Task is being marked as completed:', taskId);
        let taskMovedToCompleted = null;

        // First, find the task in 'all' to ensure we have the most up-to-date version
        const taskFromAll = tasks.all.find(t => t.id === taskId);
        if (taskFromAll) {
          taskMovedToCompleted = { 
            ...taskFromAll, 
            completed: true, 
            completedAt: new Date().toISOString(),
            // Preserve the original scheduled date for recurring tasks
            scheduledDate: taskFromAll.scheduledDate || taskFromAll.startDateOfSeries
          };
        }

        // Remove from active collections
        if (tasks.today) {
          tasks.today = tasks.today.filter(t => t.id !== taskId);
        }
        
        // Remove from specific tag groups
        if (taskToToggle.tag && taskToToggle.tag.id && tasks[taskToToggle.tag.id]) {
          tasks[taskToToggle.tag.id] = tasks[taskToToggle.tag.id].filter(t => t.id !== taskId);
        }
        
        // Ensure the task is in 'all' with updated completion status
        if (taskMovedToCompleted) {
          tasks.all = tasks.all.map(t => t.id === taskId ? taskMovedToCompleted : t);
          
          // Add to completed collection
          if (!tasks.completed) tasks.completed = [];
          tasks.completed = tasks.completed.filter(t => t.id !== taskId); // Remove if already there
          tasks.completed.push(taskMovedToCompleted);
          
          console.log('Moved task to completed collection:', taskMovedToCompleted);
        }
        
        // If a recurring task instance was completed, generate the next instance
        const isRecurringSeriesRelated = taskToToggle.isRepeat || (taskToToggle.seriesId && taskToToggle.repeat && taskToToggle.repeat !== 'none');
        console.log(`[useTaskManagement][handleToggleTaskCompletion] Task ID: ${taskToToggle.id}, title: '${taskToToggle.title}', isRepeat: ${taskToToggle.isRepeat}, seriesId: ${taskToToggle.seriesId}, repeat: ${taskToToggle.repeat}. Is recurring series related: ${isRecurringSeriesRelated}`);

        if (isRecurringSeriesRelated) {
          console.log(`[useTaskManagement][handleToggleTaskCompletion] Entered recurring-related block for task ${taskToToggle.id}. isCompleting: ${newCompletionState}`);
          if (!newCompletionState) { // Task is being marked as INCOMPLETE
            // If an incomplete task is part of a series and its base definition might have been hidden,
            // we might need to re-evaluate. For now, just ensuring it's in active lists.
            // (Future: Consider if base task needs to be explicitly shown if all instances are removed/incomplete)
            console.log(`[useTaskManagement][handleToggleTaskCompletion] Task ${taskToToggle.id} marked as INCOMPLETE. Handled by general logic moving from completed.`);
          } else { // Task is being marked as COMPLETE
            console.log(`[useTaskManagement][handleToggleTaskCompletion] Task ${taskToToggle.id} is being marked COMPLETE. Attempting to find baseTaskDefinition.`);
            // Find the base task definition using its seriesId
            // The task being toggled might be an instance or a base definition of a recurring series
            const baseTaskDefinition = tasks.all.find(
              (t) => t.seriesId === taskToToggle.seriesId && (t.isRepeat === false || typeof t.isRepeat === 'undefined')
            );
            console.log(`[useTaskManagement][handleToggleTaskCompletion] Found baseTaskDefinition for series ${taskToToggle.seriesId}:`, baseTaskDefinition ? { id: baseTaskDefinition.id, title: baseTaskDefinition.title, isRepeat: baseTaskDefinition.isRepeat } : null);

            if (baseTaskDefinition) {
              console.log(`[useTaskManagement][handleToggleTaskCompletion] Base definition ID ${baseTaskDefinition.id} found. Generating next instance using original scheduledDate of completed task: ${taskToToggle.scheduledDate}`);
              // Use the original scheduledDate of the task *just completed* to find the next one
              const nextInstance = generateNextDisplayableTaskInstance(baseTaskDefinition, new Date(taskToToggle.scheduledDate)); // taskToToggle.scheduledDate IS the original date of the item just completed
              console.log('[useTaskManagement][handleToggleTaskCompletion] Received nextInstance from recurrenceUtils:', JSON.parse(JSON.stringify(nextInstance))); // Log a deep copy
              
              if (nextInstance) {
                // Check if this exact instance (by ID or by seriesId + scheduledDate) already exists and is active
                const instanceExists = (tasks.all || []).some(t => 
                  t.id === nextInstance.id || 
                  (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                );

                if (!instanceExists) {
                  console.log('Adding new next instance to tasks:', nextInstance);
                  // Add to 'all' collection
                  if (!tasks.all) tasks.all = [];
                  tasks.all.push(nextInstance);

                  // Add to specific tag group if applicable
                  if (nextInstance.tag && nextInstance.tag.id) {
                    const nextInstanceTagGroup = nextInstance.tag.id;
                    if (!tasks[nextInstanceTagGroup]) tasks[nextInstanceTagGroup] = [];
                    tasks[nextInstanceTagGroup].push(nextInstance);
                  }

                  // Add to 'today' collection if scheduled for today
                  if (nextInstance.scheduledDate && isToday(parseISO(nextInstance.scheduledDate))) {
                    if (!tasks.today) tasks.today = [];
                    tasks.today.push(nextInstance);
                    console.log('Added next instance to today collection:', nextInstance);
                  }
                } else {
                  console.log('Next instance already exists or is a duplicate, not adding:', nextInstance);
                }
              } else {
                console.log('No further instances to generate for series:', taskToToggle.seriesId);
              }
            } else {
              console.log('No base task definition found for series:', taskToToggle.seriesId);
            }
          }
        }
      } else {
        // Task is being marked as NOT completed (incomplete)
        console.log('Task is being marked as incomplete:', taskId);
        let taskMovedFromCompleted = null;

        // Find the task in 'all' to get the most up-to-date version
        const taskFromAll = tasks.all.find(t => t.id === taskId);
        if (taskFromAll) {
          taskMovedFromCompleted = { 
            ...taskFromAll, 
            completed: false, 
            completedAt: undefined
          };
          
          // Update in 'all' collection
          tasks.all = tasks.all.map(t => t.id === taskId ? taskMovedFromCompleted : t);
          
          // Remove from completed collection
          if (tasks.completed) {
            tasks.completed = tasks.completed.filter(t => t.id !== taskId);
          }
          
          // Add back to 'today' if scheduled for today
          if (taskMovedFromCompleted.scheduledDate && isToday(parseISO(taskMovedFromCompleted.scheduledDate))) {
            if (!tasks.today) tasks.today = [];
            if (!tasks.today.some(t => t.id === taskId)) {
              tasks.today.push(taskMovedFromCompleted);
            }
          }
          
          // Add back to its specific tag group if applicable
          if (taskMovedFromCompleted.tag && taskMovedFromCompleted.tag.id) {
            const tagId = taskMovedFromCompleted.tag.id;
            if (!tasks[tagId]) tasks[tagId] = [];
            if (!tasks[tagId].some(t => t.id === taskId)) {
              tasks[tagId].push(taskMovedFromCompleted);
            }
          }
          
          console.log('Moved task from completed collection:', taskMovedFromCompleted);
        }
      }
      
      // Save all changes to localStorage
      localStorage.setItem("tasks", JSON.stringify(tasks));
      console.log('Saved updated tasks to localStorage after toggle completion');
      
      // Dispatch events to ensure UI updates immediately
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: tasks } // Send the fully updated tasks object
      }));
      
      return true;
    } catch (error) {
      console.error('Error in handleToggleTaskCompletion:', error);
      return false;
    }
  }, []);

  const ensureActiveRecurringInstances = useCallback(() => {
    console.log('[ensureActiveRecurringInstances] Running check...');
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allCurrentTasks = tasks.all || [];
    let updated = false;

    const baseRecurringTasks = allCurrentTasks.filter(task => {
      const hasRepeatPattern = task.repeat && task.repeat !== 'none';
      const isBaseTask = task.isRepeat === false || typeof task.isRepeat === 'undefined';
      return hasRepeatPattern && isBaseTask && task.seriesId; // Ensure base task has a seriesId
    });

    console.log('[ensureActiveRecurringInstances] Found base recurring tasks to process:', baseRecurringTasks.length);
    baseRecurringTasks.forEach(baseTask => {
      console.log(`[ensureActiveRecurringInstances] Processing base task: ID=${baseTask.id}, seriesId=${baseTask.seriesId}, Title='${baseTask.title}'`);

      // Log all existing instances for this series from allCurrentTasks
      const existingInstancesForSeries = allCurrentTasks.filter(
        instance => instance.seriesId === baseTask.seriesId && instance.isRepeat === true
      );
      console.log(`[ensureActiveRecurringInstances] Found ${existingInstancesForSeries.length} existing instances in allCurrentTasks for series ${baseTask.seriesId}:`,
        JSON.parse(JSON.stringify(existingInstancesForSeries.map(inst => ({id: inst.id, scheduledDate: inst.scheduledDate, completed: inst.completed}))))
      );

      const activeInstanceExists = existingInstancesForSeries.some(
        instance => !instance.completed
      );
      console.log(`[ensureActiveRecurringInstances] Active instance exists for series ${baseTask.seriesId}? ${activeInstanceExists}`);

      if (!activeInstanceExists) {
        console.log(`[ensureActiveRecurringInstances] No active instance found for series ${baseTask.seriesId}. Attempting to generate one.`);
        if (!baseTask.startDateOfSeries && baseTask.scheduledDate) {
          baseTask.startDateOfSeries = baseTask.scheduledDate;
        } else if (!baseTask.startDateOfSeries && baseTask.createdAt) {
          baseTask.startDateOfSeries = baseTask.createdAt;
        } else if (!baseTask.startDateOfSeries) {
          baseTask.startDateOfSeries = new Date().toISOString(); 
        }
        console.log(`[ensureActiveRecurringInstances] Base task for generation (series ${baseTask.seriesId}):`, JSON.parse(JSON.stringify(baseTask)));
        
        let rawFirstInstance = generateNextDisplayableTaskInstance(baseTask, null); 
        
        if (rawFirstInstance) {
          console.log(`[ensureActiveRecurringInstances] Raw first instance generated by recurrenceUtils for series ${baseTask.seriesId}:`, JSON.parse(JSON.stringify(rawFirstInstance)));
          const firstInstance = {
            ...rawFirstInstance,
            seriesId: baseTask.seriesId, 
            isRepeat: true,              
            tag: rawFirstInstance.tag || baseTask.tag, 
            originalBaseId: baseTask.id,     
            id: rawFirstInstance.id && !String(rawFirstInstance.id).includes('undefined') && !String(rawFirstInstance.id).includes('null')
                ? rawFirstInstance.id 
                : `${baseTask.seriesId}_repeat_${new Date(rawFirstInstance.scheduledDate).getTime()}`,
            // Ensure scheduledDate is in ISO format if it's a Date object
            scheduledDate: rawFirstInstance.scheduledDate instanceof Date ? rawFirstInstance.scheduledDate.toISOString() : rawFirstInstance.scheduledDate
          };

          console.log(`[ensureActiveRecurringInstances] Enriched first instance for series ${baseTask.seriesId}:`, JSON.parse(JSON.stringify(firstInstance)));
          
          const tagGroup = firstInstance.tag ? firstInstance.tag.id : "all";
          if (!tasks[tagGroup]) tasks[tagGroup] = [];
          if (!tasks[tagGroup].some(t => t.id === firstInstance.id)) {
            tasks[tagGroup].push(firstInstance);
          }
          
          if (!tasks.all.some(t => t.id === firstInstance.id)) {
             tasks.all.push(firstInstance);
             updated = true;
             console.log(`[ensureActiveRecurringInstances] Added generated first active instance ${firstInstance.id} for series ${baseTask.seriesId} to tasks.all.`);
          } else {
            console.log(`[ensureActiveRecurringInstances] Instance ${firstInstance.id} (or equivalent) already in tasks.all for series ${baseTask.seriesId}. No update to tasks.all.`);
          }
        } else {
          console.warn(`[ensureActiveRecurringInstances] Failed to generate first instance for base task ID: ${baseTask.id}, seriesId: ${baseTask.seriesId}`);
        }
      } else {
        console.log(`[ensureActiveRecurringInstances] Active instance already exists for series ${baseTask.seriesId}. No new instance generated.`);
      }
    });

    if (updated) {
      console.log('[ensureActiveRecurringInstances] Found updates, saving tasks to localStorage.');
      localStorage.setItem("tasks", JSON.stringify(tasks));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: tasks }
      }));
    } else {
      console.log('[ensureActiveRecurringInstances] No updates made to tasks in localStorage by this run.');
    }
  }, [generateNextDisplayableTaskInstance]); // Added generateNextDisplayableTaskInstance to dependency array

  useEffect(() => {
    console.log('[useTaskManagement] Hook mounted, calling ensureActiveRecurringInstances.');
    ensureActiveRecurringInstances();
  }, [ensureActiveRecurringInstances]); // ensureActiveRecurringInstances is a callback, include it in deps

  /**
   * Get all recurring task instances for a given time range
   * @param {Date} startDate - Start of the range
   * @param {Date} endDate - End of the range
   * @returns {Array} Array of recurring task instances
   */
  const getRecurringTaskInstances = useCallback((startDate, endDate) => {
    // Get all tasks from localStorage
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allTasks = tasks.all || [];
    
    // Find all recurring tasks (base tasks only, not instances)
    const recurringTasks = allTasks.filter(task => 
      task.repeat && task.repeat !== 'none' && !task.isRepeat && task.seriesId // Ensure base task has a seriesId
    );
    
    console.log('[getRecurringTaskInstances] Found base recurring tasks:', recurringTasks.length);
    
    // Generate instances for each recurring task
    let instances = [];
    recurringTasks.forEach(baseTask => {
      // Make sure we have a valid task with a repeat property and seriesId
      if (!baseTask || !baseTask.repeat || baseTask.repeat === 'none' || !baseTask.seriesId) return;
      
      // Generate recurring instances using the baseTask
      const generatedRawInstances = generateRecurringTasks(baseTask, endDate);
      console.log(`[getRecurringTaskInstances] Generated ${generatedRawInstances.length} raw instances for task: ${baseTask.title} (seriesId: ${baseTask.seriesId})`);
      
      // Filter to only include instances in the date range and enrich them
      const enrichedAndFilteredInstances = generatedRawInstances
        .filter(instance => {
          if (!instance.scheduledDate) return false;
          const instanceDate = new Date(instance.scheduledDate);
          return instanceDate >= startDate && instanceDate <= endDate;
        })
        .map(instance => ({
          ...instance,
          seriesId: baseTask.seriesId, // Ensure seriesId is from the base task
          isRepeat: true,             // Mark as a repeat instance
          tag: instance.tag || baseTask.tag, // Inherit tag if not present
          originalBaseId: baseTask.id, // Store reference to the base task ID
          // Ensure the instance ID is unique if not already, using seriesId and scheduledDate
          id: instance.id && !instance.id.includes('undefined') 
              ? instance.id 
              : `${baseTask.seriesId}_${new Date(instance.scheduledDate).getTime()}`
        }));
      
      console.log(`[getRecurringTaskInstances] After filtering and enriching, ${enrichedAndFilteredInstances.length} instances remain in date range for series ${baseTask.seriesId}`);
      instances = [...instances, ...enrichedAndFilteredInstances];
    });
    
    return instances;
  }, []);

  return {
    handleCreateTask,
    handleUpdateTask,
    getTasksInSeries,
    getRecurringTaskInstances,
    handleToggleTaskCompletion, // Added
    ensureActiveRecurringInstances // Added
  };
}
