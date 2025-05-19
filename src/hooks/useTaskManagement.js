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
    
    if (!updatedTaskData || !updatedTaskData.id) {
      console.error('Invalid task data provided for update:', updatedTaskData);
      return false;
    }
    
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      let originalTask = null;
      let originalTagId = null;
      let newTagId = updatedTaskData.tag ? updatedTaskData.tag.id : null;
      
      console.log('Current tasks from localStorage:', tasks);
      console.log('Looking for task with ID:', updatedTaskData.id);
      
      // Log all task IDs to help debug
      const allTaskIds = [];
      for (const groupKey in tasks) {
        if (Array.isArray(tasks[groupKey])) {
          const groupIds = tasks[groupKey].map(t => t.id);
          allTaskIds.push(...groupIds);
        }
      }
      console.log('All task IDs in storage:', [...new Set(allTaskIds)]);
      
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
            
            // Now set originalTask to this new instance
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

  const handleToggleTaskCompletion = useCallback((taskId) => {
    console.log('handleToggleTaskCompletion called with taskId:', taskId);
    
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks); // This 'tasks' object will be mutated and saved
      let taskToToggle = null;
      let newCompletionState = false;

      console.log('Current tasks from localStorage:', tasks);

      // Find the task to toggle by its ID across all collections
      for (const groupKey in tasks) {
        if (Array.isArray(tasks[groupKey])) {
          const taskIndex = tasks[groupKey].findIndex(t => t.id === taskId);
          if (taskIndex !== -1) {
            taskToToggle = { ...tasks[groupKey][taskIndex] }; // Clone the task
            newCompletionState = !taskToToggle.completed;
            console.log('Found task to toggle:', taskToToggle, 'New completion state:', newCompletionState);
            // No break here, we will update it in all its locations later if needed
          }
        }
      }

      if (!taskToToggle) {
        console.error("Task not found for completion toggle:", taskId);
        
        // If this is a recurring task instance, we might need to create it first
        if (taskId.seriesId && taskId.isRepeat) {
          console.log('This appears to be a recurring task instance. Attempting to create it first.');
          
          // Find the base task definition
          let baseTask = null;
          for (const groupKey in tasks) {
            if (Array.isArray(tasks[groupKey])) {
              const found = tasks[groupKey].find(t => 
                t.seriesId === taskId.seriesId && 
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
              ...taskId,
              createdAt: new Date().toISOString()
            };
            
            // Add the new instance to collections
            const instanceTagGroup = newInstance.tag ? newInstance.tag.id : "all";
            if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
            if (!tasks.all) tasks.all = [];
            
            tasks[instanceTagGroup].push(newInstance);
            tasks.all.push(newInstance);
            
            // Now set originalTask to this new instance
            taskToToggle = newInstance;
            if (taskToToggle.tag) {
              originalTagId = taskToToggle.tag.id;
            }
            
            console.log('Created missing task instance:', newInstance);
          } else {
            console.error('Could not find base task definition for series:', taskId.seriesId);
            return false;
          }
        } else {
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

        // Remove from 'today' if present
        if (tasks.today) {
          tasks.today = tasks.today.filter(t => {
            if (t.id === taskId) { taskMovedToCompleted = { ...t, completed: true, completedAt: new Date().toISOString() }; return false; }
            return true;
          });
        }
        // Remove from specific tag groups (if any)
        if (taskToToggle.tag && taskToToggle.tag.id && tasks[taskToToggle.tag.id]){
            tasks[taskToToggle.tag.id] = tasks[taskToToggle.tag.id].filter(t => {
                if (t.id === taskId && !taskMovedToCompleted) { taskMovedToCompleted = { ...t, completed: true, completedAt: new Date().toISOString() }; }
                return t.id !== taskId;
            });
        }
        // If not found in today or tag group, get it from 'all' to move to completed
        if (!taskMovedToCompleted) {
            const taskFromAll = tasks.all.find(t => t.id === taskId);
            if (taskFromAll) {
                taskMovedToCompleted = { ...taskFromAll, completed: true, completedAt: new Date().toISOString() };
            }
        }

        // Ensure 'completed' collection exists and add the task
        if (taskMovedToCompleted) {
            if (!tasks.completed) tasks.completed = [];
            tasks.completed = tasks.completed.filter(t => t.id !== taskId); // Remove if already there (e.g. toggling back and forth)
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

        // Remove from 'completed' collection
        if (tasks.completed) {
          tasks.completed = tasks.completed.filter(t => {
            if (t.id === taskId) { taskMovedFromCompleted = { ...t, completed: false }; delete taskMovedFromCompleted.completedAt; return false; }
            return true;
          });
        }
        
        // Add back to 'today' if it was scheduled for today and not already there
        if (taskMovedFromCompleted && taskMovedFromCompleted.scheduledDate && isToday(parseISO(taskMovedFromCompleted.scheduledDate))) {
          if (!tasks.today) tasks.today = [];
          if (!tasks.today.some(t => t.id === taskId)) {
            tasks.today.push(taskMovedFromCompleted);
          }
        }
        // Add back to its specific tag group if applicable
        if (taskMovedFromCompleted && taskMovedFromCompleted.tag && taskMovedFromCompleted.tag.id) {
            const tagId = taskMovedFromCompleted.tag.id;
            if (!tasks[tagId]) tasks[tagId] = [];
            if (!tasks[tagId].some(t => t.id === taskId)) {
                tasks[tagId].push(taskMovedFromCompleted);
            }
        }
        // Ensure it's in 'all' (should already be, but as a fallback)
        if (taskMovedFromCompleted && !tasks.all.some(t => t.id === taskId)) {
            tasks.all.push(taskMovedFromCompleted);
        }
         console.log('Moved task from completed collection:', taskMovedFromCompleted);
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
    console.log('Running ensureActiveRecurringInstances');
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allCurrentTasks = tasks.all || [];
    let updated = false;

    // Find all base recurring tasks - both those with isRepeat=false and those with repeat property
    const baseRecurringTasks = allCurrentTasks.filter(task => {
      // Check if it has a repeat pattern
      const hasRepeatPattern = task.repeat && task.repeat !== 'none';
      
      // Check if it's a base task (not an instance)
      // Either explicitly marked as isRepeat=false or not marked as an instance (isRepeat is undefined)
      const isBaseTask = task.isRepeat === false || typeof task.isRepeat === 'undefined';
      
      // For tasks created via CommandBar, they might not have isRepeat set but have a repeat pattern
      return hasRepeatPattern && isBaseTask;
    });

    console.log('Found base recurring tasks:', baseRecurringTasks.length, baseRecurringTasks);

    baseRecurringTasks.forEach(baseTask => {
      // If the task doesn't have a seriesId yet, assign one
      if (!baseTask.seriesId && baseTask.repeat && baseTask.repeat !== 'none') {
        baseTask.seriesId = `series_${Date.now().toString()}_${Math.random().toString(36).substring(2, 9)}`;
        updated = true;
        console.log('Added missing seriesId to base task:', baseTask.id, baseTask.seriesId);
      }
      
      // Check if there's already an active instance for this series
      const activeInstanceExists = allCurrentTasks.some(
        instance => instance.seriesId === baseTask.seriesId && 
                   instance.isRepeat === true && 
                   !instance.completed
      );

      console.log('Active instance exists for series', baseTask.seriesId, ':', activeInstanceExists);

      if (!activeInstanceExists) {
        // Ensure base task has a start date for the series for generating the first instance
        if (!baseTask.startDateOfSeries && baseTask.scheduledDate) {
          baseTask.startDateOfSeries = baseTask.scheduledDate;
          console.log('Using scheduledDate as startDateOfSeries:', baseTask.scheduledDate);
        } else if (!baseTask.startDateOfSeries && baseTask.createdAt) {
          baseTask.startDateOfSeries = baseTask.createdAt;
          console.log('Using createdAt as startDateOfSeries:', baseTask.createdAt);
        } else if (!baseTask.startDateOfSeries) {
          baseTask.startDateOfSeries = new Date().toISOString(); // Fallback, less ideal
          console.log('Using current date as startDateOfSeries fallback');
        }
        
        // Generate the first instance
        console.log('Generating first instance for base task:', baseTask);
        const firstInstance = generateNextDisplayableTaskInstance(baseTask, null); // null for lastInstanceDate to get the first one
        
        if (firstInstance) {
          console.log('Successfully generated first instance:', firstInstance);
          const tagGroup = firstInstance.tag ? firstInstance.tag.id : "all";
          if (!tasks[tagGroup]) tasks[tagGroup] = [];
          tasks[tagGroup].push(firstInstance);
          if (!tasks.all.find(t => t.id === firstInstance.id)) {
             tasks.all.push(firstInstance);
          }
          updated = true;
          console.log(`Generated first active instance for series ${baseTask.seriesId}`, firstInstance);
        } else {
          console.error('Failed to generate first instance for base task:', baseTask);
        }
      }
    });

    if (updated) {
      console.log('Updating localStorage with new instances');
      localStorage.setItem("tasks", JSON.stringify(tasks));
      
      // Dispatch a storage event to notify other components
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
    } else {
      console.log('No updates needed for recurring tasks');
    }
  }, []);
  
  // Call once on hook initialization (or app start)
  // This is a side effect and might be better handled by the component consuming the hook
  // or an application initialization routine.
  // For now, let's include it here, guarded by a simple check to run once per session or similar logic if possible.
  // However, directly calling it here will run every time the hook is used, which might not be ideal.
  // A better approach might be to export it and have a parent component call it once.
  // For this exercise, I'll call it, assuming its idempotency or that it's managed externally.
  // useEffect(() => {
  //  ensureActiveRecurringInstances();
  // }, []); // Empty dependency array means it runs once when the component using the hook mounts.

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
      task.repeat && task.repeat !== 'none' && !task.isRepeat
    );
    
    console.log('Found recurring tasks:', recurringTasks);
    
    // Generate instances for each recurring task
    let instances = [];
    recurringTasks.forEach(task => {
      // Make sure we have a valid task with a repeat property
      if (!task || !task.repeat || task.repeat === 'none') return;
      
      // Generate recurring instances
      const taskInstances = generateRecurringTasks(task, endDate);
      console.log(`Generated ${taskInstances.length} instances for task:`, task.title);
      
      // Filter to only include instances in the date range
      const filteredInstances = taskInstances.filter(instance => {
        if (!instance.scheduledDate) return false;
        const instanceDate = new Date(instance.scheduledDate);
        return instanceDate >= startDate && instanceDate <= endDate;
      });
      
      console.log(`After filtering, ${filteredInstances.length} instances remain in date range`);
      instances = [...instances, ...filteredInstances];
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
