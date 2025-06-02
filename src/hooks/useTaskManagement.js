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
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);

      const newTask = { ...task, createdAt: new Date().toISOString() };
      
      // Ensure basic collections exist
      if (!tasks.all) tasks.all = [];
      if (!tasks.today) tasks.today = [];
      let tagGroup = newTask.tag ? newTask.tag.id : "all";
      if (!tasks[tagGroup]) tasks[tagGroup] = [];

      // Generate seriesId for new base recurring tasks
      if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat && !newTask.seriesId) {
        newTask.seriesId = `series_${Date.now().toString()}_${Math.random().toString(36).substring(2, 9)}`;
        // Ensure startDateOfSeries is set for rrule generation for the base task
        if (!newTask.startDateOfSeries && newTask.scheduledDate) {
            newTask.startDateOfSeries = newTask.scheduledDate;
        } else if (!newTask.startDateOfSeries && !newTask.scheduledDate) {
            // For custom recurrence patterns, use createdAt as startDateOfSeries but don't force scheduledDate
            newTask.startDateOfSeries = newTask.createdAt;
            // Only set scheduledDate for non-custom patterns
            if (newTask.repeat !== 'custom') {
                newTask.scheduledDate = newTask.createdAt; // Also set scheduledDate for consistency if not present
            }
        } else if (!newTask.startDateOfSeries) {
            newTask.startDateOfSeries = newTask.createdAt;
        }
      }

      // Add/Update the newTask (which could be a base definition or a single task/instance) to 'all' and its tag group
      // Remove existing task if it's an update to prevent duplicates, before adding the new/updated one.
      tasks.all = tasks.all.filter(t => t.id !== newTask.id);
      tasks.all.push(newTask);

      if (tagGroup !== "all") {
        tasks[tagGroup] = tasks[tagGroup].filter(t => t.id !== newTask.id);
        tasks[tagGroup].push(newTask);
      }
      
      // If it's a new base recurring task, generate only the first instance
      if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat) {
        // Ensure baseTask has required fields for instance generation
        const baseTaskForRRule = { ...newTask }; 
        if (!baseTaskForRRule.startDateOfSeries) {
          // For custom recurring tasks, use the dtstart from rruleOptions if available
          if (baseTaskForRRule.rruleOptions && baseTaskForRRule.rruleOptions.dtstart) {
            baseTaskForRRule.startDateOfSeries = new Date(baseTaskForRRule.rruleOptions.dtstart).toISOString();
          } else if (baseTaskForRRule.scheduledDate) {
            baseTaskForRRule.startDateOfSeries = baseTaskForRRule.scheduledDate;
          } else if (baseTaskForRRule.createdAt) {
            baseTaskForRRule.startDateOfSeries = baseTaskForRRule.createdAt;
          } else {
            baseTaskForRRule.startDateOfSeries = new Date().toISOString();
          }
        }

        // Generate only the first instance, not all instances
        const { generateNextDisplayableTaskInstance } = require('../utils/recurrenceUtils');
        const firstInstance = generateNextDisplayableTaskInstance(baseTaskForRRule, null);

        if (firstInstance) {
          // Ensure the instance has proper properties
          const instanceToAdd = {
            ...firstInstance,
            seriesId: baseTaskForRRule.seriesId,
            isRepeat: true,
            tag: firstInstance.tag || baseTaskForRRule.tag,
            originalBaseId: baseTaskForRRule.id
          };

          // Add instance to 'all' if not already present
          if (!tasks.all.some(t => t.id === instanceToAdd.id)) {
            tasks.all.push(instanceToAdd);
          }
          // Add instance to its tag group
          const instanceTagGroup = instanceToAdd.tag ? instanceToAdd.tag.id : "all";
          if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
          if (instanceTagGroup !== "all" && !tasks[instanceTagGroup].some(t => t.id === instanceToAdd.id)) {
            tasks[instanceTagGroup].push(instanceToAdd);
          }
          // Add instance to 'today' collection if scheduled for today
          if (instanceToAdd.scheduledDate && isToday(parseISO(instanceToAdd.scheduledDate))) {
            if (!tasks.today.some(t => t.id === instanceToAdd.id)) {
              tasks.today.push(instanceToAdd);
            }
          }
        }
      } else if (newTask.scheduledDate && isToday(parseISO(newTask.scheduledDate))) {
        // If it's a non-recurring task OR a single existing instance being updated, and scheduled for today
        // Ensure it's in the 'today' array (handles cases where a task is moved to today)
        tasks.today = tasks.today.filter(t => t.id !== newTask.id); // Remove if present to re-add (updates position or ensures no dupes)
        tasks.today.push(newTask);
      }
      
      // Save all changes (base task + all instances) to localStorage in one go
      localStorage.setItem("tasks", JSON.stringify(tasks));

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
      // Error in handleCreateTask
    }
  }, []);

  const handleUpdateTask = useCallback((updatedTaskData) => {
    
    if (!updatedTaskData) {
      return false;
    }
    
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      let originalTask = null;
      let originalTagId = null;
      let newTagId = updatedTaskData.tag ? updatedTaskData.tag.id : null;
      
      // Handle task deletion if _deleteScope is present
      if (updatedTaskData._deleteScope) {
        const taskId = updatedTaskData.id;
        const scope = updatedTaskData._deleteScope;
        
        // Find the task to delete
        let taskToDelete = null;
        let taskSeriesId = null;
        let taskScheduledDate = null;
        
        // Find the task in any collection
        Object.keys(tasks).forEach((group) => {
          if (Array.isArray(tasks[group])) {
            const foundTask = tasks[group].find(task => task.id === taskId);
            if (foundTask && !taskToDelete) {
              taskToDelete = foundTask;
              taskSeriesId = foundTask.seriesId;
              taskScheduledDate = foundTask.scheduledDate;
            }
          }
        });
        
        if (!taskToDelete) {
          return false; // No changes if task not found
        }
        
        // Handle different deletion scopes
        if (taskSeriesId && scope === 'all') {
          // For 'all' scope, delete all tasks in the series
          Object.keys(tasks).forEach((group) => {
            if (Array.isArray(tasks[group])) {
              tasks[group] = tasks[group].filter(
                (task) => task.seriesId !== taskSeriesId
              );
            }
          });
        } else if (scope === 'single') {
          // Check if this is a base task being deleted
          const isBaseTask = taskSeriesId && taskToDelete.isRepeat === false && !taskToDelete.originalBaseId;
          
          // For 'single' scope deletion of recurring tasks: Delete the instance and generate next
          const isRecurringInstance = taskToDelete.isRepeat === true || 
                                     (taskSeriesId && taskToDelete.originalBaseId) ||
                                     (taskSeriesId && taskToDelete.id && taskToDelete.id.includes('_repeat_'));
          
          // Additional check: if task has seriesId but no explicit isRepeat, it's likely an instance
          const isLikelyInstance = taskSeriesId && !taskToDelete.repeat && taskToDelete.id !== taskSeriesId;
          
          if (isBaseTask) {
            // Handle base task deletion - remove it and generate next instance
            Object.keys(tasks).forEach((group) => {
              if (Array.isArray(tasks[group])) {
                tasks[group] = tasks[group].filter(
                  (task) => task.id !== taskId
                );
              }
            });
            
            // Generate next instance using the base task as template
            const { generateNextDisplayableTaskInstance } = require('../utils/recurrenceUtils');
            const nextInstance = generateNextDisplayableTaskInstance(taskToDelete, new Date(taskToDelete.scheduledDate));
            
            if (nextInstance) {
              // Check if this exact instance already exists
              const instanceExists = Object.values(tasks)
                .flat()
                .some(t => 
                  t.id === nextInstance.id || 
                  (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                );
              
              if (!instanceExists) {
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
                if (nextInstance.scheduledDate) {
                  const today = new Date();
                  const instanceDate = new Date(nextInstance.scheduledDate);
                  if (instanceDate.toDateString() === today.toDateString()) {
                    if (!tasks.today) tasks.today = [];
                    tasks.today.push(nextInstance);
                  }
                }
              }
            }
          } else if (taskSeriesId && (isRecurringInstance || isLikelyInstance)) {
            // Find the base task definition
            const allTasks = Object.values(tasks).flat();
            const candidateTasks = allTasks.filter(t => t.seriesId === taskSeriesId);
            const baseTaskDefinition = candidateTasks.find(t => t.isRepeat === false || typeof t.isRepeat === 'undefined');
            
            if (baseTaskDefinition) {
              // Remove the current task from all collections first
              Object.keys(tasks).forEach((group) => {
                if (Array.isArray(tasks[group])) {
                  tasks[group] = tasks[group].filter(
                    (task) => task.id !== taskId
                  );
                }
              });
              
              // Generate next instance synchronously
              const { generateNextDisplayableTaskInstance } = require('../utils/recurrenceUtils');
              const nextInstance = generateNextDisplayableTaskInstance(baseTaskDefinition, new Date(taskToDelete.scheduledDate));
              
              if (nextInstance) {
                // Check if this exact instance already exists
                const instanceExists = Object.values(tasks)
                  .flat()
                  .some(t => 
                    t.id === nextInstance.id || 
                    (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                  );
                
                if (!instanceExists) {
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
                  if (nextInstance.scheduledDate) {
                    const today = new Date();
                    const instanceDate = new Date(nextInstance.scheduledDate);
                    if (instanceDate.toDateString() === today.toDateString()) {
                      if (!tasks.today) tasks.today = [];
                      tasks.today.push(nextInstance);
                    }
                  }
                }
              }
            } else {
              // Just remove the task if no base task found
              Object.keys(tasks).forEach((group) => {
                if (Array.isArray(tasks[group])) {
                  tasks[group] = tasks[group].filter(task => task.id !== taskId);
                }
              });
            }
          } else {
            // For non-recurring tasks, just delete the specific task
            Object.keys(tasks).forEach((group) => {
              if (Array.isArray(tasks[group])) {
                tasks[group] = tasks[group].filter(task => task.id !== taskId);
              }
            });
          }
        } else {
          // For other scopes or non-recurring tasks, just delete the specific task
          Object.keys(tasks).forEach((group) => {
            if (Array.isArray(tasks[group])) {
              tasks[group] = tasks[group].filter(task => task.id !== taskId);
            }
          });
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
      
      // Note: Detached task creation is now handled in CommandBar.jsx
      // This ensures the user can make changes before the detachment occurs
      
      // Ensure basic collections exist
      if (!tasks.all) tasks.all = [];
      if (!tasks.today) tasks.today = [];
      if (newTagId && !tasks[newTagId]) tasks[newTagId] = [];
      
      // Check if this is a new task being created
      const isNewTask = !updatedTaskData.id || 
                        !tasks.all.some(t => t.id === updatedTaskData.id);
      
      // If it's a new task, generate an ID and handle it as a creation
      if (isNewTask) {
        
        // Generate an ID if one doesn't exist
        const newTask = {
          ...updatedTaskData,
          id: updatedTaskData.id || `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          createdAt: new Date().toISOString()
        };
        
        // If it's a recurring task, ensure it has a seriesId
        if (newTask.repeat && newTask.repeat !== 'none' && !newTask.seriesId) {
          newTask.seriesId = `series_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
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
          const instances = generateRecurringTasks(newTask);
          
          if (instances && instances.length > 0) {
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
      
      // First, find and store the original task for reference
      for (const groupKey in tasks) {
        if (Array.isArray(tasks[groupKey])) {
          const foundTask = tasks[groupKey].find(t => t.id === updatedTaskData.id);
          if (foundTask && !originalTask) {
            originalTask = { ...foundTask };
            if (originalTask.tag) {
              originalTagId = originalTask.tag.id;
            }
            break;
          }
        }
      }
      
      if (!originalTask) {
        // If this is a recurring task instance, we might need to create it first
        if (updatedTaskData.seriesId && updatedTaskData.isRepeat) {
          
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
          } else {
            return false;
          }
        } else {
          return false;
        }
      }
      

      
      // Create the updated task by merging original with updates
      const mergedTask = { ...originalTask, ...updatedTaskData };
      
      // Clean up internal flags before saving
      const cleanedTask = { ...mergedTask };
      delete cleanedTask._editScope;
      delete cleanedTask._updateSeries;
      delete cleanedTask._originalTask;
      
      // Check for series updates first before normal task updates
      const isSeriesUpdate = mergedTask._updateSeries === true || mergedTask._editScope === 'all';
      
      if (isSeriesUpdate && mergedTask.isRepeat === true && (mergedTask.originalBaseId || mergedTask.seriesId)) {
        
        // Find the base task definition
        const baseTask = mergedTask.originalBaseId 
          ? tasks.all.find(t => t.id === mergedTask.originalBaseId)
          : mergedTask; // If no originalBaseId, this task IS the base task
        
        if (baseTask) {
          
          // First, update the base task definition with the new properties
          const updatedBaseTask = {
            ...baseTask,
            title: cleanedTask.title,
            notes: cleanedTask.notes,
            tag: cleanedTask.tag,
            addToCalendar: cleanedTask.addToCalendar,
            updatedAt: new Date().toISOString(),
            // Preserve base task properties
            id: baseTask.id,
            scheduledDate: baseTask.scheduledDate,
            repeat: baseTask.repeat,
            seriesId: baseTask.seriesId,
            startDateOfSeries: baseTask.startDateOfSeries,
            isRepeat: baseTask.isRepeat || false
          };
          
          // Update base task in all collection
          const baseTaskIndex = tasks.all.findIndex(t => t.id === baseTask.id);
          if (baseTaskIndex !== -1) {
            tasks.all[baseTaskIndex] = updatedBaseTask;
          }
          
          // Update base task in tag collections
          if (originalTagId && tasks[originalTagId]) {
            tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== baseTask.id);
          }
          if (newTagId) {
            if (!tasks[newTagId]) tasks[newTagId] = [];
            if (!tasks[newTagId].find(t => t.id === baseTask.id)) {
              tasks[newTagId].push(updatedBaseTask);
            }
          }
          // Note: If newTagId is null/undefined (No Tag), the task remains only in 'all' collection
          
          // Use the getTasksInSeries function to get ALL tasks in the series
          const allTasksInSeries = getTasksInSeries([...tasks.all, ...(tasks.completed || [])], mergedTask.seriesId);
          
          // Filter out the current task being edited to avoid duplicate updates
          const instances = allTasksInSeries.filter(t => t.id !== mergedTask.id);
          
          // Update all other instances with new properties
          instances.forEach(instance => {
            // Update the instance with new properties while preserving instance-specific data
            const updatedInstance = {
              ...instance,
              title: cleanedTask.title,
              notes: cleanedTask.notes,
              tag: cleanedTask.tag,
              updatedAt: new Date().toISOString(),
              // Preserve instance-specific properties
              id: instance.id,
              scheduledDate: instance.scheduledDate,
              isRepeat: instance.isRepeat,
              seriesId: instance.seriesId,
              originalBaseId: instance.originalBaseId
            };
           
           // Check if this instance is completed
           const isCompletedInstance = instance.completed || instance.completedAt;
           
           if (isCompletedInstance) {
               // Update in completed collection
               if (tasks.completed) {
                 const completedIndex = tasks.completed.findIndex(t => t.id === instance.id);
                 if (completedIndex !== -1) {
                   tasks.completed[completedIndex] = updatedInstance;
                 }
               }
           } else {
               // Update in all collection for active instances
               const allIndex = tasks.all.findIndex(t => t.id === instance.id);
               if (allIndex !== -1) {
                 tasks.all[allIndex] = updatedInstance;
               }
             
             // Remove from old tag collection if it exists
             if (originalTagId && tasks[originalTagId]) {
               tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== instance.id);
             }
             
             // Add to new tag collection for active instances
             if (newTagId) {
               if (!tasks[newTagId]) tasks[newTagId] = [];
               if (!tasks[newTagId].find(t => t.id === instance.id)) {
                 tasks[newTagId].push(updatedInstance);
                 console.log(`Added task ${instance.id} to new tag collection ${newTagId}`);
               }
             }
           }
         });
         
         // Update the current instance being edited with preserved recurring properties
         // Skip this if the current task IS the base task (already updated above)
         if (mergedTask.id !== baseTask.id) {
           const updatedCurrentInstance = {
             ...mergedTask,
             title: cleanedTask.title,
             notes: cleanedTask.notes,
             tag: cleanedTask.tag,
             updatedAt: new Date().toISOString(),
             // Preserve instance-specific properties
             id: mergedTask.id,
             scheduledDate: mergedTask.scheduledDate,
             isRepeat: mergedTask.isRepeat,
             seriesId: mergedTask.seriesId,
             originalBaseId: mergedTask.originalBaseId
           };
           
           // Check if current instance is completed
           const isCurrentInstanceCompleted = mergedTask.completed || mergedTask.completedAt;
           
           if (isCurrentInstanceCompleted) {
             // Update in completed collection
             if (tasks.completed) {
               const completedIndex = tasks.completed.findIndex(t => t.id === mergedTask.id);
               if (completedIndex !== -1) {
                 tasks.completed[completedIndex] = updatedCurrentInstance;
                 console.log(`Updated current completed task ${mergedTask.id} in completed collection`);
               }
             }
           } else {
             // Update current instance in all collection
             const currentInstanceIndex = tasks.all.findIndex(t => t.id === mergedTask.id);
             if (currentInstanceIndex !== -1) {
               tasks.all[currentInstanceIndex] = updatedCurrentInstance;
               console.log(`Updated current active task ${mergedTask.id} in all collection`);
             }
             
             // Remove from old tag collection
             if (originalTagId && tasks[originalTagId]) {
               tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== mergedTask.id);
             }
             
             // Update current instance in its new tag collection
             if (newTagId) {
               if (!tasks[newTagId]) tasks[newTagId] = [];
               if (!tasks[newTagId].find(t => t.id === mergedTask.id)) {
                 tasks[newTagId].push(updatedCurrentInstance);
                 console.log(`Added current task ${mergedTask.id} to new tag collection ${newTagId}`);
               }
             }
           }
         }
         
         // Skip the normal task update logic since we've handled the series update
         console.log('Series-wide update completed, skipping normal update logic');
         localStorage.setItem("tasks", JSON.stringify(tasks));
         window.dispatchEvent(new StorageEvent('storage', {
           key: 'tasks',
           newValue: JSON.stringify(tasks),
           url: window.location.href
         }));
         return true;
        }
        
        // If we reach here, the series update was initiated but base task wasn't found
        console.log('Series update initiated but base task not found, proceeding with normal update');
      } else {
        console.log('Not a series update, proceeding with normal task update logic');
      }
      
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
          tasks[newTagId].push(cleanedTask);
          console.log(`Added task to new tag collection: ${newTagId}`);
        }
      }
      
      // Update the task in the 'all' collection
      const allTaskIndex = tasks.all ? tasks.all.findIndex(t => t.id === updatedTaskData.id) : -1;
      if (allTaskIndex !== -1) {
        tasks.all[allTaskIndex] = cleanedTask;
        console.log('Updated task in all collection');
      } else if (tasks.all) {
        tasks.all.push(cleanedTask);
        console.log('Added task to all collection');
      } else {
        tasks.all = [cleanedTask];
        console.log('Created all collection with task');
      }
      
      // Handle recurring task updates
      if (mergedTask.repeat && mergedTask.repeat !== 'none') {
        console.log('Updating a recurring task');
        
        // Only generate a new seriesId for base tasks (not instances)
        if (!mergedTask.seriesId && !mergedTask.isRepeat) {
          mergedTask.seriesId = `series_${Date.now().toString()}_${Math.random().toString(36).substring(2, 9)}`;
          cleanedTask.seriesId = mergedTask.seriesId;
          console.log('Added missing seriesId to base task:', mergedTask.seriesId);
        } else if (!mergedTask.seriesId && mergedTask.isRepeat && mergedTask.originalBaseId) {
          // For instances, try to get seriesId from the base task
          const baseTask = tasks.all.find(t => t.id === mergedTask.originalBaseId);
          if (baseTask && baseTask.seriesId) {
            mergedTask.seriesId = baseTask.seriesId;
            cleanedTask.seriesId = baseTask.seriesId;
            console.log('Inherited seriesId from base task:', baseTask.seriesId);
          }
        }
        
        // Ensure the task has a startDateOfSeries
        if (!mergedTask.startDateOfSeries) {
          mergedTask.startDateOfSeries = mergedTask.scheduledDate || mergedTask.createdAt;
          cleanedTask.startDateOfSeries = mergedTask.startDateOfSeries;
          console.log('Set startDateOfSeries to:', mergedTask.startDateOfSeries);
        }
        
        // Check if this is a series-wide update
        const isSeriesUpdate = mergedTask._updateSeries === true || mergedTask._editScope === 'all';
        
        // If this is a base task (not an instance), update all instances
        // Skip this if we already handled a series update above
        if (!mergedTask.isRepeat && !isSeriesUpdate) {
          console.log('This is a base recurring task, updating instances');
          
          // Find all instances of this series (including completed ones)
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
          
          // Also check the 'completed' collection for completed instances
          if (tasks.completed && Array.isArray(tasks.completed)) {
            const completedInstances = tasks.completed.filter(t => 
              t.seriesId === mergedTask.seriesId && 
              t.isRepeat === true && 
              t.id !== mergedTask.id
            );
            instances = [...instances, ...completedInstances];
          }
          
          console.log(`Found ${instances.length} instances of this series`);
          
          // For series-wide updates, update all properties on all instances
          if (isSeriesUpdate && instances.length > 0) {
            console.log('Performing series-wide update on all instances');
            
            // Remove instances from old tag collection
            if (originalTagId && tasks[originalTagId]){
                tasks[originalTagId] = tasks[originalTagId].filter(t => 
                  !(t.seriesId === mergedTask.seriesId && t.isRepeat === true)
                );
            }
            
            // Update all instances with new properties
             instances.forEach(instance => {
               // Update the instance with new properties while preserving instance-specific data
               const updatedInstance = {
                 ...instance,
                 title: cleanedTask.title,
                 notes: cleanedTask.notes,
                 tag: cleanedTask.tag,
                 updatedAt: new Date().toISOString(),
                 // Preserve instance-specific properties
                 id: instance.id,
                 scheduledDate: instance.scheduledDate,
                 isRepeat: instance.isRepeat,
                 seriesId: instance.seriesId,
                 originalBaseId: instance.originalBaseId
               };
              
              // Check if this instance is completed
              const isCompletedInstance = instance.completed || instance.completedAt;
              
              if (isCompletedInstance) {
                // Update in completed collection
                const completedIndex = tasks.completed.findIndex(t => t.id === instance.id);
                if (completedIndex !== -1) {
                  tasks.completed[completedIndex] = updatedInstance;
                }
              } else {
                // Update in all collection for active instances
                const allIndex = tasks.all.findIndex(t => t.id === instance.id);
                if (allIndex !== -1) {
                  tasks.all[allIndex] = updatedInstance;
                }
                
                // Add to new tag collection for active instances
                if (newTagId) {
                  if (!tasks[newTagId]) tasks[newTagId] = [];
                  tasks[newTagId].push(updatedInstance);
                }
              }
            });
          } else if (originalTagId !== newTagId && instances.length > 0) {
            // Only update tag on all instances if tag has changed (non-series update)
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
                  task.tag = cleanedTask.tag;
                }
              });
            }
            
            // Update instances in completed collection
            if (tasks.completed) {
              tasks.completed.forEach(task => {
                if (task.seriesId === mergedTask.seriesId && task.isRepeat === true) {
                  task.tag = cleanedTask.tag;
                }
              });
            }
            
            // Add active instances to new tag collection
            if (newTagId) {
              if (!tasks[newTagId]) tasks[newTagId] = [];
              instances.forEach(instance => {
                // Only add to tag collection if the instance is not completed
                const isCompletedInstance = instance.completed || instance.completedAt;
                if (!isCompletedInstance) {
                  const updatedInstance = { ...instance, tag: cleanedTask.tag };
                  tasks[newTagId].push(updatedInstance);
                }
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
            const nextInstance = generateNextDisplayableTaskInstance(cleanedTask, null);
            
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
        // If this is an instance being updated, handle series-wide updates if needed
        // Skip this if we already handled a series update above
        else if (mergedTask.isRepeat === true && mergedTask.originalBaseId && !isSeriesUpdate) {
          console.log('🔄 [DEBUG] This is a recurring instance, checking for series-wide updates');
          console.log('🔄 [DEBUG] Instance details:', {
            id: mergedTask.id,
            originalBaseId: mergedTask.originalBaseId,
            seriesId: mergedTask.seriesId,
            isRepeat: mergedTask.isRepeat,
            _updateSeries: mergedTask._updateSeries,
            _editScope: mergedTask._editScope
          });
          
          // Find the base task
          const baseTask = tasks.all.find(t => t.id === mergedTask.originalBaseId);
          console.log('🔄 [DEBUG] Base task search result:', baseTask ? 'FOUND' : 'NOT FOUND');
          if (!baseTask) {
            console.log('🔄 [DEBUG] Base task not found! Available tasks in all collection:', tasks.all.map(t => ({ id: t.id, title: t.title, isRepeat: t.isRepeat })));
          }
          if (baseTask) {
            console.log('🔄 [DEBUG] Base task details:', {
              id: baseTask.id,
              title: baseTask.title,
              seriesId: baseTask.seriesId,
              isRepeat: baseTask.isRepeat,
              repeat: baseTask.repeat
            });
            
            // Series updates are now handled earlier in the function
            // This section only handles non-series updates for instances

            
            if (newTagId !== null && originalTagId !== newTagId) {
              // Non-series update: only update tag on base task

              baseTask.tag = cleanedTask.tag;
              
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
      }
      

      localStorage.setItem("tasks", JSON.stringify(tasks));
      
      // Dispatch events to ensure UI updates

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


        // Data recovery for object: If it's a repeat task but seriesId is missing, try to get it from base task via originalBaseId
        if (isRecurringInstance && !seriesId && taskToToggle.originalBaseId) {
          console.warn(`[handleToggleTaskCompletion] Object: Recurring instance ${taskId} is missing seriesId. Attempting recovery via originalBaseId: ${taskToToggle.originalBaseId}`);
          baseTask = tasks.all.find(t => t.id === taskToToggle.originalBaseId && (t.isRepeat === false || typeof t.isRepeat === 'undefined'));
          if (baseTask && baseTask.seriesId) {
            taskToToggle.seriesId = baseTask.seriesId;
            seriesId = baseTask.seriesId; // Update local variable too

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

        } else {

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

        for (const groupKey in tasks) {
          if (Array.isArray(tasks[groupKey])) {
            const taskIndex = tasks[groupKey].findIndex(t => t.id === taskId);
            if (taskIndex !== -1) {
              taskToToggle = { ...tasks[groupKey][taskIndex] }; // Clone the task
              isRecurringInstance = !!taskToToggle.isRepeat;
              seriesId = taskToToggle.seriesId; // Get seriesId from the found task
              newCompletionState = !taskToToggle.completed;


              // Data recovery: If it's a repeat task but seriesId is missing, try to get it from base task via originalBaseId
              if (taskToToggle.isRepeat && !taskToToggle.seriesId && taskToToggle.originalBaseId) {
                console.warn(`[handleToggleTaskCompletion] Recurring instance ${taskToToggle.id} is missing seriesId. Attempting recovery via originalBaseId: ${taskToToggle.originalBaseId}`);
                const baseTaskForRecovery = tasks.all.find(t => t.id === taskToToggle.originalBaseId && (t.isRepeat === false || typeof t.isRepeat === 'undefined'));
                if (baseTaskForRecovery && baseTaskForRecovery.seriesId) {
                  taskToToggle.seriesId = baseTaskForRecovery.seriesId;
                  seriesId = baseTaskForRecovery.seriesId; // Update local variable too

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

        if (isRecurringInstance && seriesId) { // seriesId would have been extracted from string ID or recovered


          baseTask = tasks.all.find(
            (t) => t.seriesId === seriesId && (t.isRepeat === false || typeof t.isRepeat === 'undefined')
          );


          if (!baseTask) {
            console.error(`[handleToggleTaskCompletion] CRITICAL: Could not find base task for seriesId: '${seriesId}'. This is likely the root cause of 'Task not found' error.`);
            const potentialBaseTasks = tasks.all.filter(t => (t.isRepeat === false || typeof t.isRepeat === 'undefined') && t.repeat && t.repeat !== 'none');
            const similarSeriesIdTasks = tasks.all.filter(t => t.seriesId && seriesId && (t.seriesId.includes(seriesId) || seriesId.includes(t.seriesId)));
          } else {

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
            

          } else {
            console.error('Could not find base task definition for series:', seriesId);
            return false;
          }
        } else {
          console.error("Task not found for completion toggle:", taskId);
          return false;
        }
      }
      

      
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
          

        }
        
        // If a recurring task instance was completed, generate the next instance
        const isRecurringSeriesRelated = taskToToggle.isRepeat || (taskToToggle.seriesId && taskToToggle.repeat && taskToToggle.repeat !== 'none');


        if (isRecurringSeriesRelated) {

          if (!newCompletionState) { // Task is being marked as INCOMPLETE
            // If an incomplete task is part of a series and its base definition might have been hidden,
            // we might need to re-evaluate. For now, just ensuring it's in active lists.
            // (Future: Consider if base task needs to be explicitly shown if all instances are removed/incomplete)

          } else { // Task is being marked as COMPLETE

            // Find the base task definition using its seriesId
            // The task being toggled might be an instance or a base definition of a recurring series
            const baseTaskDefinition = tasks.all.find(
              (t) => t.seriesId === taskToToggle.seriesId && (t.isRepeat === false || typeof t.isRepeat === 'undefined')
            );


            if (baseTaskDefinition) {

              // Use the original scheduledDate of the task *just completed* to find the next one
              const nextInstance = generateNextDisplayableTaskInstance(baseTaskDefinition, new Date(taskToToggle.scheduledDate)); // taskToToggle.scheduledDate IS the original date of the item just completed

              
              if (nextInstance) {
                // Check if this exact instance (by ID or by seriesId + scheduledDate) already exists and is active
                const instanceExists = (tasks.all || []).some(t => 
                  t.id === nextInstance.id || 
                  (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                );

                if (!instanceExists) {

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

                  }
                } else {

                }
              } else {

              }
            } else {

            }
          }
        }
      } else {
        // Task is being marked as NOT completed (incomplete)

        let taskMovedFromCompleted = null;

        // Find the task in 'all' to get the most up-to-date version
        const taskFromAll = tasks.all.find(t => t.id === taskId);
        if (taskFromAll) {
          taskMovedFromCompleted = { 
            ...taskFromAll, 
            completed: false, 
            completedAt: undefined
          };
          
          // If this was a recurring task, handle detachment based on type
          if (taskMovedFromCompleted.seriesId && (taskMovedFromCompleted.isRepeat === true || taskMovedFromCompleted.isRepeat === false)) {

            
            if (taskMovedFromCompleted.isRepeat === true) {
              // For instances, simply detach them from the series
              taskMovedFromCompleted.isRepeat = false;
              taskMovedFromCompleted.seriesId = null;
              taskMovedFromCompleted.originalBaseId = null;
              taskMovedFromCompleted.repeat = 'none';

            } else if (taskMovedFromCompleted.isRepeat === false) {
              // For base definitions, create a new standalone task and preserve the original base
              const originalSeriesId = taskMovedFromCompleted.seriesId;
              const originalRepeat = taskMovedFromCompleted.repeat;
              const originalRruleOptions = taskMovedFromCompleted.rruleOptions;
              
              // Create a new standalone task from the base definition
              const standaloneTask = {
                ...taskMovedFromCompleted,
                id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                isRepeat: false,
                seriesId: null,
                originalBaseId: null,
                repeat: 'none',
                rruleOptions: null,
                completed: false,
                completedAt: undefined
              };
              
              // Add the standalone task to collections
              tasks.all.push(standaloneTask);
              
              // Add to 'today' if scheduled for today
              if (standaloneTask.scheduledDate && isToday(parseISO(standaloneTask.scheduledDate))) {
                if (!tasks.today) tasks.today = [];
                tasks.today.push(standaloneTask);
              }
              
              // Add to its specific tag group if applicable
              if (standaloneTask.tag && standaloneTask.tag.id) {
                const tagId = standaloneTask.tag.id;
                if (!tasks[tagId]) tasks[tagId] = [];
                tasks[tagId].push(standaloneTask);
              }
              
              // Restore the original base task definition to preserve the series
              taskMovedFromCompleted.seriesId = originalSeriesId;
              taskMovedFromCompleted.repeat = originalRepeat;
              taskMovedFromCompleted.rruleOptions = originalRruleOptions;
              taskMovedFromCompleted.isRepeat = false;
              taskMovedFromCompleted.completed = true; // Keep it completed to hide from active view
              

            }
          }
          
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
          

        }
      }
      
      // Save all changes to localStorage
      localStorage.setItem("tasks", JSON.stringify(tasks));

      
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

      return false;
    }
  }, []);

  const ensureActiveRecurringInstances = useCallback(() => {

    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);
    const allCurrentTasks = tasks.all || [];
    let updated = false;

    const baseRecurringTasks = allCurrentTasks.filter(task => {
      const hasRepeatPattern = task.repeat && task.repeat !== 'none';
      const isBaseTask = task.isRepeat === false || typeof task.isRepeat === 'undefined';
      return hasRepeatPattern && isBaseTask && task.seriesId; // Ensure base task has a seriesId
    });


    baseRecurringTasks.forEach(baseTask => {


      // Log all existing instances for this series from allCurrentTasks
      const existingInstancesForSeries = allCurrentTasks.filter(
        instance => instance.seriesId === baseTask.seriesId && instance.isRepeat === true
      );


      const activeInstanceExists = existingInstancesForSeries.some(
        instance => !instance.completed
      );


      if (!activeInstanceExists) {

        if (!baseTask.startDateOfSeries && baseTask.scheduledDate) {
          baseTask.startDateOfSeries = baseTask.scheduledDate;
        } else if (!baseTask.startDateOfSeries && baseTask.createdAt) {
          baseTask.startDateOfSeries = baseTask.createdAt;
        } else if (!baseTask.startDateOfSeries) {
          baseTask.startDateOfSeries = new Date().toISOString(); 
        }

        
        let rawFirstInstance = generateNextDisplayableTaskInstance(baseTask, null); 
        
        if (rawFirstInstance) {

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


          
          const tagGroup = firstInstance.tag ? firstInstance.tag.id : "all";
          if (!tasks[tagGroup]) tasks[tagGroup] = [];
          if (!tasks[tagGroup].some(t => t.id === firstInstance.id)) {
            tasks[tagGroup].push(firstInstance);
          }
          
          if (!tasks.all.some(t => t.id === firstInstance.id)) {
             tasks.all.push(firstInstance);
             updated = true;

          } else {

          }
        } else {

        }
      } else {

      }
    });

    if (updated) {

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

    }
  }, [generateNextDisplayableTaskInstance]); // Added generateNextDisplayableTaskInstance to dependency array

  useEffect(() => {

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
    

    
    // Generate instances for each recurring task
    let instances = [];
    recurringTasks.forEach(baseTask => {
      // Make sure we have a valid task with a repeat property and seriesId
      if (!baseTask || !baseTask.repeat || baseTask.repeat === 'none' || !baseTask.seriesId) return;
      
      // Generate recurring instances using the baseTask
      const generatedRawInstances = generateRecurringTasks(baseTask, endDate);

      
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
