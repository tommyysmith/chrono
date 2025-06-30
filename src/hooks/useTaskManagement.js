import { generateRecurringTasks, generateNextDisplayableTaskInstance } from '../utils/recurrenceUtils';
import { useEffect, useCallback, useRef } from 'react'; // Added useCallback and useRef
import { isToday, parseISO } from 'date-fns'; // Import date-fns functions
import { getNextRecurrenceDate } from '../utils/recurrenceUtils';

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
      
      // For a new recurring base task, preserve the original scheduled date for startDateOfSeries
      // then set scheduledDate to undefined to prevent the base task from being displayed
      let originalScheduledDate = null;
      if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat) {
        // Use _originalScheduledDate from CommandBar if available, otherwise fall back to scheduledDate
        originalScheduledDate = newTask._originalScheduledDate || newTask.scheduledDate;
        newTask.scheduledDate = undefined;
        // Clean up the temporary field
        delete newTask._originalScheduledDate;
      }

      // Add/Update the newTask (which could be a base definition or a single task/instance) to 'all' and its tag group
      // Remove existing task if it's an update to prevent duplicates, before adding the new/updated one.
      
      // Always add/update tasks in the 'all' collection for reference
      tasks.all = tasks.all.filter(t => t.id !== newTask.id);
      tasks.all.push(newTask);
      
      // For recurring base tasks, don't add them to other collections
      // as they should not appear as completable tasks in the UI - only their instances should
      const isRecurringBaseTask = newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat;
      
      if (!isRecurringBaseTask && tagGroup !== "all") {
        tasks[tagGroup] = tasks[tagGroup].filter(t => t.id !== newTask.id);
        tasks[tagGroup].push(newTask);
      }
      
      // If it's a new base recurring task, generate only the first instance
      if (newTask.repeat && newTask.repeat !== 'none' && !newTask.isRepeat) {

        
        // Ensure baseTask has required fields for instance generation
        const baseTaskForRRule = { ...newTask }; 
        
        // Crucially, ensure the baseTaskForRRule also has its scheduledDate undefined
        // if it's a recurring task, to align with the modification made to newTask.
        if (baseTaskForRRule.repeat && baseTaskForRRule.repeat !== 'none' && !baseTaskForRRule.isRepeat) {
          baseTaskForRRule.scheduledDate = undefined;
        }
        
        if (!baseTaskForRRule.startDateOfSeries) {
          // For custom recurring tasks, use the dtstart from rruleOptions if available
          if (baseTaskForRRule.rruleOptions && baseTaskForRRule.rruleOptions.dtstart) {
            baseTaskForRRule.startDateOfSeries = new Date(baseTaskForRRule.rruleOptions.dtstart).toISOString();
          } else if (originalScheduledDate) {
            baseTaskForRRule.startDateOfSeries = originalScheduledDate;
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
          // Check if an instance with this scheduled date already exists to prevent duplicates
          const expectedInstanceId = `${baseTaskForRRule.seriesId}_repeat_${new Date(firstInstance.scheduledDate).getTime()}`;
          const instanceAlreadyExists = tasks.all.some(instance => 
            instance.seriesId === baseTaskForRRule.seriesId && 
            instance.isRepeat === true &&
            (instance.id === expectedInstanceId || 
             instance.id === firstInstance.id ||
             (instance.scheduledDate && firstInstance.scheduledDate && 
              new Date(instance.scheduledDate).getTime() === new Date(firstInstance.scheduledDate).getTime()))
          );
          
          if (!instanceAlreadyExists) {
            // Ensure the instance has proper properties
            const instanceToAdd = {
              ...firstInstance,
              seriesId: baseTaskForRRule.seriesId,
              isRepeat: true,
              tag: firstInstance.tag || baseTaskForRRule.tag,
              originalBaseId: baseTaskForRRule.id,
              id: firstInstance.id && !String(firstInstance.id).includes('undefined') && !String(firstInstance.id).includes('null')
                  ? firstInstance.id 
                  : expectedInstanceId
            };

            console.log('[CREATION DEBUG] Adding new instance to collections:', {
              instanceId: instanceToAdd.id,
              seriesId: instanceToAdd.seriesId,
              scheduledDate: instanceToAdd.scheduledDate,
              timestamp: new Date().toISOString()
            });

            // Add instance to 'all' if not already present
            const existsInAll = tasks.all.some(t => t.id === instanceToAdd.id);
            if (!existsInAll) {
              tasks.all.push(instanceToAdd);
            }
            
            // Add instance to its tag group
            const instanceTagGroup = instanceToAdd.tag ? instanceToAdd.tag.id : "all";
            if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
            const existsInTagGroup = instanceTagGroup !== "all" && tasks[instanceTagGroup].some(t => t.id === instanceToAdd.id);
            if (instanceTagGroup !== "all" && !existsInTagGroup) {
              tasks[instanceTagGroup].push(instanceToAdd);
            }
            
            // Add instance to 'today' collection if scheduled for today
            if (instanceToAdd.scheduledDate && isToday(parseISO(instanceToAdd.scheduledDate))) {
              const existsInToday = tasks.today.some(t => t.id === instanceToAdd.id);
              if (!existsInToday) {
                tasks.today.push(instanceToAdd);
              }
            }
          } else {
            console.log('[CREATION DEBUG] Skipping instance creation - already exists:', {
              seriesId: baseTaskForRRule.seriesId,
              expectedInstanceId,
              timestamp: new Date().toISOString()
            });
          }
        }
      } else if (!isRecurringBaseTask && newTask.scheduledDate && isToday(parseISO(newTask.scheduledDate))) {
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
      console.log('🔍 [TASK-LOOKUP-DEBUG] Searching for task with ID:', updatedTaskData.id);
      console.log('🔍 [TASK-LOOKUP-DEBUG] Available collections:', Object.keys(tasks));
      console.log('🔍 [TASK-LOOKUP-DEBUG] All tasks in storage:', tasks.all ? tasks.all.map(t => ({ id: t.id, title: t.title, isRepeat: t.isRepeat, seriesId: t.seriesId })) : 'No all collection');
      
      for (const groupKey in tasks) {
        if (Array.isArray(tasks[groupKey])) {
          const foundTask = tasks[groupKey].find(t => t.id === updatedTaskData.id);
          if (foundTask && !originalTask) {
            console.log('🔍 [TASK-LOOKUP-DEBUG] Found task in collection:', groupKey, {
              id: foundTask.id,
              title: foundTask.title,
              isRepeat: foundTask.isRepeat,
              seriesId: foundTask.seriesId
            });
            originalTask = { ...foundTask };
            if (originalTask.tag) {
              originalTagId = originalTask.tag.id;
            }
            break;
          }
        }
      }
      
      if (!originalTask) {
        console.log('🔍 [TASK-LOOKUP-DEBUG] Task not found in any collection!');
      }
      

      
      if (!originalTask) {
        console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Original task not found, checking if this is a recurring instance');
        console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Updated task data:', { id: updatedTaskData.id, seriesId: updatedTaskData.seriesId, isRepeat: updatedTaskData.isRepeat });
        
        // If this is a recurring task instance, we might need to create it first
        if (updatedTaskData.seriesId && updatedTaskData.isRepeat) {
          console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] This is a recurring instance, searching for base task');
          
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
            console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Base task found, creating new instance');
            console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Base task:', { id: baseTask.id, seriesId: baseTask.seriesId, isRepeat: baseTask.isRepeat });
            
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
            console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Created and added new instance to collections');
            
            // Set originalTask to this new instance
            originalTask = newInstance;
            if (originalTask.tag) {
              originalTagId = originalTask.tag.id;
            }
          } else {
            console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Base task not found, cannot create instance');
            return false;
          }
        } else {
          console.log('🔥 CHRONO_DEBUG_SERIES [TASK LOOKUP] Not a recurring instance, cannot proceed without original task');
          return false;
        }
      }
      

      
      console.log('🔥 CHRONO_DEBUG_SERIES [TASK MERGE] Creating merged task from original and updates');
      console.log('🔥 CHRONO_DEBUG_SERIES [TASK MERGE] Original task:', { id: originalTask.id, seriesId: originalTask.seriesId, isRepeat: originalTask.isRepeat, _editScope: originalTask._editScope, _updateSeries: originalTask._updateSeries });
      console.log('🔥 CHRONO_DEBUG_SERIES [TASK MERGE] Update data:', { id: updatedTaskData.id, _editScope: updatedTaskData._editScope, _updateSeries: updatedTaskData._updateSeries });
      console.log('🔥 CHRONO_DEBUG_SERIES [TASK MERGE] Full update data:', updatedTaskData);
      
      // Create the updated task by merging original with updates
      const mergedTask = { ...originalTask, ...updatedTaskData };
      console.log('🔥 CHRONO_DEBUG_SERIES [TASK MERGE] Merged task flags:', { _editScope: mergedTask._editScope, _updateSeries: mergedTask._updateSeries });
      console.log('🔥 CHRONO_DEBUG_SERIES [TASK MERGE] Full merged task:', mergedTask);
      
      // Clean up internal flags before saving
      const cleanedTask = { ...mergedTask };
      delete cleanedTask._editScope;
      delete cleanedTask._updateSeries;
      delete cleanedTask._originalTask;
      
              // Check for single instance updates first - these should be handled simply
        const isSingleInstanceUpdate = mergedTask._editScope === 'single';
        
        // Check for series updates before normal task updates
        const isSeriesUpdate = mergedTask._updateSeries === true || mergedTask._editScope === 'all';
        console.log('🔥 CHRONO_DEBUG_SERIES [UPDATE TYPE CHECK] Single instance update:', isSingleInstanceUpdate);
        console.log('🔥 CHRONO_DEBUG_SERIES [SERIES CHECK] Is series update:', isSeriesUpdate);
        let seriesUpdateResult = null;
      
              // Handle single instance updates with simple logic
        if (isSingleInstanceUpdate) {
          console.log('🚀 [CHRONO-DEBUG] Handling single instance update with simple logic');
          console.log('🚀 [CHRONO-DEBUG] Updated task data:', {
            id: cleanedTask.id,
            title: cleanedTask.title,
            notes: cleanedTask.notes,
            tag: cleanedTask.tag,
            priority: cleanedTask.priority,
            scheduledDate: cleanedTask.scheduledDate,
            seriesId: cleanedTask.seriesId,
            isRepeat: cleanedTask.isRepeat
          });
          console.log('🚀 [CHRONO-DEBUG] Original task found:', !!originalTask);
          console.log('🚀 [CHRONO-DEBUG] Original task details:', originalTask ? {
            id: originalTask.id,
            title: originalTask.title,
            isRepeat: originalTask.isRepeat,
            seriesId: originalTask.seriesId
          } : 'null');
        
                  // Simple update: find and replace the task in all collections
          let taskUpdated = false;
          
          // Special handling for recurring task instances that don't exist yet
          if (!originalTask && cleanedTask.isRepeat && cleanedTask.seriesId) {
            console.log('🚀 [CHRONO-DEBUG] Recurring task instance not found in storage - creating it first');
            
            // Find the base task to copy properties from
            const baseTask = tasks.all.find(t => 
              t.seriesId === cleanedTask.seriesId && 
              (t.isRepeat === false || typeof t.isRepeat === 'undefined')
            );
            
            if (baseTask) {
              console.log('🚀 [CHRONO-DEBUG] Found base task for new instance:', baseTask.id);
              
              // Create the new instance with the edited properties
              const newInstance = {
                ...baseTask, // Start with base task properties
                ...cleanedTask, // Override with edited properties
                id: cleanedTask.id,
                isRepeat: true,
                originalBaseId: baseTask.id,
                createdAt: new Date().toISOString()
              };
              
              console.log('🚀 [CHRONO-DEBUG] Creating new recurring instance:', {
                id: newInstance.id,
                title: newInstance.title,
                scheduledDate: newInstance.scheduledDate,
                seriesId: newInstance.seriesId
              });
              
              // Add to all collection
              tasks.all.push(newInstance);
              
              // Add to tag collection if it has a tag
              if (newInstance.tag && newInstance.tag.id) {
                if (!tasks[newInstance.tag.id]) {
                  tasks[newInstance.tag.id] = [];
                }
                tasks[newInstance.tag.id].push(newInstance);
              }
              
              // Add to today collection if scheduled for today
              if (newInstance.scheduledDate && isToday(parseISO(newInstance.scheduledDate))) {
                if (!tasks.today) tasks.today = [];
                tasks.today.push(newInstance);
              }
              
              taskUpdated = true;
              console.log('🚀 [CHRONO-DEBUG] Created new recurring instance successfully');
            } else {
              console.log('🚀 [CHRONO-DEBUG] Base task not found for recurring instance');
              return false;
            }
          } else {
            // Update existing task in all collection
            if (tasks.all) {
              const taskIndex = tasks.all.findIndex(t => t.id === cleanedTask.id);
              if (taskIndex !== -1) {
                tasks.all[taskIndex] = { ...tasks.all[taskIndex], ...cleanedTask };
                taskUpdated = true;
                console.log('🚀 [CHRONO-DEBUG] Updated existing task in all collection at index:', taskIndex);
              }
            }
          }
        
                  // For existing tasks, update in tag collections and handle tag changes
          if (originalTask) {
            // Update in tag collections
            for (const groupKey in tasks) {
              if (groupKey !== 'all' && Array.isArray(tasks[groupKey])) {
                const taskIndex = tasks[groupKey].findIndex(t => t.id === cleanedTask.id);
                if (taskIndex !== -1) {
                  tasks[groupKey][taskIndex] = { ...tasks[groupKey][taskIndex], ...cleanedTask };
                  console.log(`🚀 [CHRONO-DEBUG] Updated existing task in ${groupKey} collection at index:`, taskIndex);
                }
              }
            }
            
            // Handle tag collection changes if tag was modified
            if (originalTagId !== newTagId) {
              // Remove from old tag collection
              if (originalTagId && tasks[originalTagId]) {
                tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== cleanedTask.id);
                console.log('🚀 [CHRONO-DEBUG] Removed task from old tag collection:', originalTagId);
              }
              
              // Add to new tag collection
              if (newTagId) {
                if (!tasks[newTagId]) {
                  tasks[newTagId] = [];
                }
                if (!tasks[newTagId].some(t => t.id === cleanedTask.id)) {
                  tasks[newTagId].push(cleanedTask);
                  console.log('🚀 [CHRONO-DEBUG] Added task to new tag collection:', newTagId);
                }
              }
            }
          }
        
        if (taskUpdated) {
          console.log('🚀 [CHRONO-DEBUG] Single instance update completed successfully');
          
          // Save and dispatch events
          localStorage.setItem("tasks", JSON.stringify(tasks));
          
          // Dispatch both event types that components listen to
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'tasks',
            newValue: JSON.stringify(tasks),
            url: window.location.href
          }));
          
          // Dispatch the tasks-updated event that Sidebar listens to
          window.dispatchEvent(new CustomEvent('tasks-updated', {
            detail: tasks
          }));
          
          // Dispatch the tasksUpdated event for compatibility
          window.dispatchEvent(new CustomEvent('tasksUpdated', {
            detail: { tasks: tasks }
          }));
          
          return true;
        } else {
          console.log('🚀 [CHRONO-DEBUG] Single instance update failed - task not found');
          return false;
        }
      }
      
      if (isSeriesUpdate && mergedTask.seriesId && (mergedTask.isRepeat === true || mergedTask.isRepeat === false || typeof mergedTask.isRepeat === 'undefined')) {
        console.log('🔥 CHRONO_DEBUG_SERIES === SERIES UPDATE DEBUG START ===');
        console.log('🔥 CHRONO_DEBUG_SERIES Original task data:', JSON.stringify(mergedTask, null, 2));
        console.log('🔥 CHRONO_DEBUG_SERIES Cleaned task data:', JSON.stringify(cleanedTask, null, 2));
        console.log('🔥 CHRONO_DEBUG_SERIES Tasks.all before update:', tasks.all.filter(t => t.seriesId === mergedTask.seriesId || t.id === mergedTask.seriesId).map(t => ({ id: t.id, title: t.title, seriesId: t.seriesId, originalBaseId: t.originalBaseId })));
        console.log('🔥 CHRONO_DEBUG_SERIES All tasks count:', tasks.all.length);
        console.log('🔥 CHRONO_DEBUG_SERIES Is series update:', isSeriesUpdate);
        
        // Find the base task definition with improved lookup logic
        let baseTask;
        if (mergedTask.originalBaseId) {
          // This is an instance, find the base task
          baseTask = tasks.all.find(t => t.id === mergedTask.originalBaseId);
          
          // If not found by originalBaseId, try finding by seriesId as fallback
          if (!baseTask && mergedTask.seriesId) {
            console.log('🔥 CHRONO_DEBUG_SERIES [BASE TASK LOOKUP] Base task not found by originalBaseId, trying seriesId fallback');
            console.log('🔥 CHRONO_DEBUG_SERIES [BASE TASK LOOKUP] Searching for seriesId:', mergedTask.seriesId);
            console.log('🔥 CHRONO_DEBUG_SERIES [BASE TASK LOOKUP] Available base tasks:', tasks.all.filter(t => !t.originalBaseId && (t.isRepeat === false || typeof t.isRepeat === 'undefined')).map(t => ({ id: t.id, title: t.title, seriesId: t.seriesId })));
            baseTask = tasks.all.find(t => 
              t.seriesId === mergedTask.seriesId && 
              (t.isRepeat === false || typeof t.isRepeat === 'undefined') &&
              !t.originalBaseId
            );
          }
        } else {
          // This could be the base task itself, or we need to find it by seriesId
          const isCurrentTaskBaseTask = (mergedTask.isRepeat === false || typeof mergedTask.isRepeat === 'undefined') && 
                                       mergedTask.seriesId && 
                                       !mergedTask.originalBaseId;
          
          if (isCurrentTaskBaseTask) {
            // Current task IS the base task - find it in the tasks.all collection
            baseTask = tasks.all.find(t => t.id === mergedTask.id) || mergedTask;
          } else {
            // Find base task by seriesId
            baseTask = tasks.all.find(t => 
              t.seriesId === mergedTask.seriesId && 
              (t.isRepeat === false || typeof t.isRepeat === 'undefined') &&
              !t.originalBaseId
            );
          }
        }
        
        // CRITICAL FIX: Prevent duplicate base task creation
        // Check if we found multiple base tasks for the same series (this should never happen)
        const allBaseTasksForSeries = tasks.all.filter(t => 
          t.seriesId === mergedTask.seriesId && 
          (t.isRepeat === false || typeof t.isRepeat === 'undefined') &&
          !t.originalBaseId
        );
        
        if (allBaseTasksForSeries.length > 1) {
          console.log('🔥 CHRONO_DEBUG_SERIES [DUPLICATE DETECTION] Multiple base tasks found for series:', mergedTask.seriesId);
          console.log('🔥 CHRONO_DEBUG_SERIES [DUPLICATE DETECTION] Duplicate base tasks:', allBaseTasksForSeries.map(t => ({ id: t.id, title: t.title, scheduledDate: t.scheduledDate })));
          
          // Remove duplicate base tasks, keeping only the first one
          const primaryBaseTask = allBaseTasksForSeries[0];
          const duplicateBaseTasks = allBaseTasksForSeries.slice(1);
          
          duplicateBaseTasks.forEach(duplicate => {
            console.log('🔥 CHRONO_DEBUG_SERIES [DUPLICATE REMOVAL] Removing duplicate base task:', duplicate.id);
            // Remove from tasks.all
            tasks.all = tasks.all.filter(t => t.id !== duplicate.id);
            // Remove from tag collections
            Object.keys(tasks).forEach(tagId => {
              if (tagId !== 'all' && Array.isArray(tasks[tagId])) {
                tasks[tagId] = tasks[tagId].filter(t => t.id !== duplicate.id);
              }
            });
          });
          
          baseTask = primaryBaseTask;
          console.log('🔥 CHRONO_DEBUG_SERIES [DUPLICATE REMOVAL] Using primary base task:', baseTask.id);
        }
        
        if (baseTask) {
          console.log('🔥 CHRONO_DEBUG_SERIES [BASE TASK UPDATE] Base task found:', {
            id: baseTask.id,
            title: baseTask.title,
            isCurrentTaskBaseTask: mergedTask.id === baseTask.id,
            mergedTaskId: mergedTask.id,
            baseTaskBeforeUpdate: JSON.stringify(baseTask)
          });
          console.log('🔥 CHRONO_DEBUG_SERIES Base task found:', JSON.stringify(baseTask, null, 2));
          console.log('🔥 CHRONO_DEBUG_SERIES Is current task the base task?', mergedTask.id === baseTask.id);
          console.log('🔥 CHRONO_DEBUG_SERIES Base task lookup method:', mergedTask.originalBaseId ? 'originalBaseId' : 'seriesId');
          
          // First, update the base task definition with the new properties
          const updatedBaseTask = {
            ...baseTask,
            // Copy all editable properties from the cleaned task
            title: cleanedTask.title,
            notes: cleanedTask.notes,
            tag: cleanedTask.tag,
            addToCalendar: cleanedTask.addToCalendar,
            priority: cleanedTask.priority,
            // Copy any other properties that might have been edited
            ...Object.keys(cleanedTask).reduce((acc, key) => {
              // Only copy properties that are not base task specific
              if (!['id', 'scheduledDate', 'repeat', 'seriesId', 'startDateOfSeries', 'isRepeat', 'originalBaseId'].includes(key)) {
                acc[key] = cleanedTask[key];
              }
              return acc;
            }, {}),
            updatedAt: new Date().toISOString(),
            // Preserve base task properties - CRITICAL FIX: Ensure base task has no scheduledDate
            id: baseTask.id,
            scheduledDate: undefined, // Base tasks should never have a scheduledDate
            repeat: baseTask.repeat,
            seriesId: baseTask.seriesId,
            // CRITICAL FIX: Update startDateOfSeries when editing from a non-first instance
            startDateOfSeries: mergedTask.originalBaseId && mergedTask.scheduledDate ? 
              mergedTask.scheduledDate : // Use the current instance's date as the new series start
              (baseTask.startDateOfSeries || baseTask.createdAt), // Fallback to original if editing the base task itself
            isRepeat: baseTask.isRepeat || false
          };
          
          console.log('🔥 CHRONO_DEBUG_SERIES [CRITICAL FIX] Ensuring base task scheduledDate is undefined');
          console.log('🔥 CHRONO_DEBUG_SERIES [CRITICAL FIX] Base task before fix - scheduledDate:', baseTask.scheduledDate);
          console.log('🔥 CHRONO_DEBUG_SERIES [CRITICAL FIX] Base task after fix - scheduledDate:', updatedBaseTask.scheduledDate);
          
          // Update base task in all collection
          const baseTaskIndex = tasks.all.findIndex(t => t.id === baseTask.id);
          console.log('🔥 CHRONO_DEBUG_SERIES Base task index in tasks.all:', baseTaskIndex);
          console.log('🔥 CHRONO_DEBUG_SERIES Updated base task data:', JSON.stringify(updatedBaseTask, null, 2));
          console.log('🔥 CHRONO_DEBUG_SERIES Base task properties preserved:', {
            id: updatedBaseTask.id,
            scheduledDate: updatedBaseTask.scheduledDate,
            repeat: updatedBaseTask.repeat,
            seriesId: updatedBaseTask.seriesId,
            startDateOfSeries: updatedBaseTask.startDateOfSeries,
            isRepeat: updatedBaseTask.isRepeat
          });
          if (baseTaskIndex !== -1) {
            const oldBaseTask = { ...tasks.all[baseTaskIndex] };
            tasks.all[baseTaskIndex] = updatedBaseTask;
            console.log('🔥 CHRONO_DEBUG_SERIES [BASE TASK UPDATE] Successfully updated base task in all collection:', {
              id: updatedBaseTask.id,
              title: updatedBaseTask.title,
              index: baseTaskIndex,
              updatedBaseTaskAfterUpdate: JSON.stringify(updatedBaseTask),
              taskInArrayAfterUpdate: JSON.stringify(tasks.all[baseTaskIndex])
            });
            console.log('🚨 [DEBUG_SERIES] Base task BEFORE update:', JSON.stringify(oldBaseTask, null, 2));
            console.log('🚨 [DEBUG_SERIES] Base task AFTER update:', JSON.stringify(tasks.all[baseTaskIndex], null, 2));
          } else {
            console.log('🔄 [BASE TASK UPDATE] ERROR: Base task not found in all collection for update!');
            console.log('🚨 [DEBUG_SERIES] ERROR: Could not find base task in tasks.all!');
          }
          
          // Update base task in tag collections
          console.log('🔄 [BASE TASK UPDATE] Updating base task in tag collections:', {
            originalTagId,
            newTagId,
            baseTaskId: baseTask.id
          });
          if (originalTagId && tasks[originalTagId]) {
            tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== baseTask.id);
            console.log('🔄 [BASE TASK UPDATE] Removed base task from original tag collection:', {
              tagId: originalTagId,
              beforeCount: tasks[originalTagId].length,
              afterCount: tasks[originalTagId].length
            });
          }
          if (newTagId) {
            if (!tasks[newTagId]) tasks[newTagId] = [];
            if (!tasks[newTagId].find(t => t.id === baseTask.id)) {
              tasks[newTagId].push(updatedBaseTask);
              console.log('🔄 [BASE TASK UPDATE] Added base task to new tag collection:', {
                tagId: newTagId,
                taskCount: tasks[newTagId].length
              });
            } else {
              console.log('🔄 [BASE TASK UPDATE] Base task already exists in new tag collection:', newTagId);
            }
          }
          // Note: If newTagId is null/undefined (No Tag), the task remains only in 'all' collection
          
          // Find all tasks in this series (including completed ones)
          const allTasksInSeries = [];
          for (const groupKey in tasks) {
            if (Array.isArray(tasks[groupKey])) {
              const groupTasks = tasks[groupKey].filter(t => 
                t.seriesId === baseTask.seriesId && 
                t.isRepeat === true
              );
              allTasksInSeries.push(...groupTasks);
            }
          }
          
          console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Starting series regeneration');
          console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Base task startDateOfSeries:', updatedBaseTask.startDateOfSeries);
          console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Found instances to remove:', allTasksInSeries.length);
          
          // Remove ALL existing instances from ALL collections
          for (const groupKey in tasks) {
            if (Array.isArray(tasks[groupKey])) {
              const beforeCount = tasks[groupKey].length;
              tasks[groupKey] = tasks[groupKey].filter(t => 
                !(t.seriesId === baseTask.seriesId && t.isRepeat === true)
              );
              const afterCount = tasks[groupKey].length;
              if (beforeCount !== afterCount) {
                console.log(`🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Removed ${beforeCount - afterCount} instances from ${groupKey}`);
              }
            }
          }
          
          // Generate the first instance of the new series
          const firstInstance = generateNextDisplayableTaskInstance(updatedBaseTask, null);
          
          if (firstInstance) {
            console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Generated first instance:', {
              id: firstInstance.id,
              scheduledDate: firstInstance.scheduledDate,
              title: firstInstance.title
            });
            
            // Add the first instance to collections
            tasks.all.push(firstInstance);
            
            // Add to tag collection if it has a tag
            const instanceTagId = firstInstance.tag ? firstInstance.tag.id : null;
            if (instanceTagId) {
              if (!tasks[instanceTagId]) tasks[instanceTagId] = [];
              tasks[instanceTagId].push(firstInstance);
              console.log(`🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Added first instance to tag collection: ${instanceTagId}`);
            }
            
            // Add to today collection if scheduled for today
            if (firstInstance.scheduledDate && isToday(parseISO(firstInstance.scheduledDate))) {
              if (!tasks.today) tasks.today = [];
              tasks.today.push(firstInstance);
              console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Added first instance to today collection');
            }
          } else {
            console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] ERROR: Failed to generate first instance');
          }
          
          // Series regeneration complete - skip normal task update logic
          console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Series regeneration completed');
          console.log('🔥 CHRONO_DEBUG_SERIES [SERIES REGENERATION] Final tasks.all count:', tasks.all.length);
          
          // Save and dispatch events
          localStorage.setItem("tasks", JSON.stringify(tasks));
          
          // Dispatch both event types that components listen to
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'tasks',
            newValue: JSON.stringify(tasks),
            url: window.location.href
          }));
          
          // Dispatch the tasks-updated event that Sidebar listens to
          window.dispatchEvent(new CustomEvent('tasks-updated', {
            detail: tasks
          }));
          
          // Dispatch the tasksUpdated event for compatibility
          window.dispatchEvent(new CustomEvent('tasksUpdated', {
            detail: { tasks: tasks }
          }));
          
          return true; // Exit early since we've handled the series update
        }
        
        // If we reach here, the series update was initiated but base task wasn't found
        console.log('🔥 CHRONO_DEBUG_SERIES [SERIES UPDATE ERROR] Base task not found for series update!');
         console.log('🔥 CHRONO_DEBUG_SERIES [SERIES UPDATE ERROR] Task details:', {
           id: mergedTask.id,
           seriesId: mergedTask.seriesId,
           originalBaseId: mergedTask.originalBaseId,
           isRepeat: mergedTask.isRepeat
         });
         console.log('🔥 CHRONO_DEBUG_SERIES [SERIES UPDATE ERROR] All available tasks:', tasks.all.map(t => ({ id: t.id, title: t.title, seriesId: t.seriesId, originalBaseId: t.originalBaseId, isRepeat: t.isRepeat })));
         console.log('🔥 CHRONO_DEBUG_SERIES [SERIES UPDATE ERROR] Tasks with matching seriesId:', tasks.all.filter(t => t.seriesId === mergedTask.seriesId).map(t => ({ id: t.id, title: t.title, seriesId: t.seriesId, originalBaseId: t.originalBaseId, isRepeat: t.isRepeat })));
        
        // CRITICAL: Do not proceed with normal update logic for existing series
        // This prevents duplicate series creation and schedule resets
        if (mergedTask.seriesId || mergedTask.originalBaseId) {
           console.log('🔥 CHRONO_DEBUG_SERIES [SERIES UPDATE ERROR] Aborting update to prevent duplicate series creation');
           console.log('🔥 CHRONO_DEBUG_SERIES [SERIES UPDATE ERROR] Preventing fallback to normal update logic');
           return { error: 'Base task not found for series update. Cannot proceed to prevent data corruption.' };
         }
        
        console.log('Series update initiated but base task not found, proceeding with normal update');
      } else {
        console.log('Not a series update, proceeding with normal task update logic');
        
        // Additional safety check: prevent converting existing series tasks to new series
        // BUT allow conversion from non-recurring to recurring tasks
        const wasOriginallyRecurring = originalTask.repeat && originalTask.repeat !== 'none';
        const isExistingSeriesTask = (mergedTask.seriesId || mergedTask.originalBaseId) && wasOriginallyRecurring;
        
        if (isExistingSeriesTask && cleanedTask.repeat) {
           console.log('🔥 CHRONO_DEBUG_SERIES [SAFETY CHECK] Preventing conversion of existing series task to new series');
           console.log('🔥 CHRONO_DEBUG_SERIES [SAFETY CHECK] Task details:', {
             id: mergedTask.id,
             seriesId: mergedTask.seriesId,
             originalBaseId: mergedTask.originalBaseId,
             hasRepeat: !!cleanedTask.repeat,
             wasOriginallyRecurring
           });
           console.log('🔥 CHRONO_DEBUG_SERIES [SAFETY CHECK] This would create a duplicate series - blocking operation');
           return { error: 'Cannot convert existing series task to new series. Use series update instead.' };
         }
      }
      
      // Check if this is a conversion from non-recurring to recurring
      const wasNonRecurring = !originalTask.repeat || originalTask.repeat === 'none';
      const isNowRecurring = mergedTask.repeat && mergedTask.repeat !== 'none';
      const isConvertingToRecurring = wasNonRecurring && isNowRecurring;
      
      console.log('🚀 [CHRONO-DEBUG] useTaskManagement conversion check:', {
        taskId: updatedTaskData.id,
        originalTask: {
          repeat: originalTask.repeat,
          seriesId: originalTask.seriesId
        },
        mergedTask: {
          repeat: mergedTask.repeat,
          rruleOptions: mergedTask.rruleOptions,
          seriesId: mergedTask.seriesId
        },
        wasNonRecurring,
        isNowRecurring,
        isConvertingToRecurring
      });
      
      if (isConvertingToRecurring) {
        console.log('🚀 [CHRONO-DEBUG] Converting non-recurring task to recurring:', {
          taskId: mergedTask.id,
          newRepeatRule: mergedTask.repeat,
          originalRepeat: originalTask.repeat,
          rruleOptions: mergedTask.rruleOptions
        });
        
        // Generate a series ID for the new recurring task
        const seriesId = `series_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // First, remove the original task from ALL collections to prevent duplication
        // Remove from 'all' collection
        if (tasks.all) {
          tasks.all = tasks.all.filter(t => t.id !== updatedTaskData.id);
        }
        
        // Remove from all other collections (tag collections, today, etc.)
        for (const groupKey in tasks) {
          if (groupKey !== 'all' && Array.isArray(tasks[groupKey])) {
            tasks[groupKey] = tasks[groupKey].filter(t => t.id !== updatedTaskData.id);
          }
        }
        
        // Create the base recurring task (no scheduledDate, not an instance)
        const baseRecurringTask = {
          ...cleanedTask,
          seriesId,
          isRepeat: false, // This is the base task
          scheduledDate: undefined, // Base tasks don't have scheduled dates
          startDateOfSeries: originalTask.scheduledDate || originalTask.createdAt || new Date().toISOString()
        };
        
        // Add the base recurring task to the 'all' collection
        if (!tasks.all) tasks.all = [];
        tasks.all.push(baseRecurringTask);
        
        // Add base task to appropriate tag collection
        const baseTaskTagId = baseRecurringTask.tag ? baseRecurringTask.tag.id : null;
        if (baseTaskTagId) {
          if (!tasks[baseTaskTagId]) tasks[baseTaskTagId] = [];
          tasks[baseTaskTagId].push(baseRecurringTask);
        }
        
        // Generate the first instance of the recurring series
        const firstInstance = generateNextDisplayableTaskInstance(baseRecurringTask, null);
        
        if (firstInstance) {
          console.log('Generated first recurring instance:', firstInstance);
          
          // Add the first instance to collections
          tasks.all.push(firstInstance);
          
          // Add to tag collection if it has a tag
          const instanceTagId = firstInstance.tag ? firstInstance.tag.id : null;
          if (instanceTagId) {
            if (!tasks[instanceTagId]) tasks[instanceTagId] = [];
            tasks[instanceTagId].push(firstInstance);
          }
          
          // Add to today collection if scheduled for today
          if (firstInstance.scheduledDate && isToday(parseISO(firstInstance.scheduledDate))) {
            if (!tasks.today) tasks.today = [];
            tasks.today.push(firstInstance);
          }
        }
        
        // Save and dispatch events
        localStorage.setItem("tasks", JSON.stringify(tasks));
        
        // Dispatch both event types that components listen to
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'tasks',
          newValue: JSON.stringify(tasks),
          url: window.location.href
        }));
        
        // Dispatch the tasks-updated event that Sidebar listens to
        window.dispatchEvent(new CustomEvent('tasks-updated', {
          detail: tasks
        }));
        
        // Dispatch the tasksUpdated event for compatibility
        window.dispatchEvent(new CustomEvent('tasksUpdated', {
          detail: { tasks: tasks }
        }));
        
        return true;
      }
      
      // Handle recurring task updates
      if (mergedTask.repeat && mergedTask.repeat !== 'none') {
        console.log('🚀 [CHRONO-DEBUG] Updating a recurring task:', {
          taskId: mergedTask.id,
          repeat: mergedTask.repeat,
          rruleOptions: mergedTask.rruleOptions,
          seriesId: mergedTask.seriesId,
          isRepeat: mergedTask.isRepeat
        });
        
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
            console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE GENERATION] No active instance found, generating a new one');
            console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE GENERATION] Series ID:', mergedTask.seriesId);
            
            // Find the latest scheduled instance to generate the next occurrence correctly
            const allSeriesInstances = [...tasks.all, ...(tasks.completed || [])]
              .filter(t => t.seriesId === mergedTask.seriesId && t.isRepeat === true)
              .sort((a, b) => new Date(b.scheduledDate) - new Date(a.scheduledDate));
            
            const latestInstanceDate = allSeriesInstances.length > 0 ? allSeriesInstances[0].scheduledDate : null;
            console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE GENERATION] Latest instance date for next generation:', latestInstanceDate);
            console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE GENERATION] All series instances found:', allSeriesInstances.map(t => ({ id: t.id, scheduledDate: t.scheduledDate, completed: t.completed })));
            
            const nextInstance = generateNextDisplayableTaskInstance(cleanedTask, latestInstanceDate);
            
            if (nextInstance) {
              console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE GENERATION] Generated new instance:', nextInstance);
              console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE GENERATION] Instance will be added to tag group:', nextInstance.tag ? nextInstance.tag.id : "all");
              const instanceTagGroup = nextInstance.tag ? nextInstance.tag.id : "all";
              if (!tasks[instanceTagGroup]) tasks[instanceTagGroup] = [];
              if (!tasks[instanceTagGroup].some(t => t.id === nextInstance.id)) {
                tasks[instanceTagGroup].push(nextInstance);
              }
            }
          }
        }
        console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE HANDLING] Checking if instance needs series-wide updates');
        console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE HANDLING] mergedTask.isRepeat:', mergedTask.isRepeat);
        console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE HANDLING] mergedTask.originalBaseId:', mergedTask.originalBaseId);
        console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE HANDLING] isSeriesUpdate:', isSeriesUpdate);
        
        // If this is an instance being updated, handle series-wide updates if needed
        // Skip this if we already handled a series update above
        if (mergedTask.isRepeat === true && mergedTask.originalBaseId && !isSeriesUpdate) {
          console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] This is a recurring instance, checking for series-wide updates');
          console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Instance details:', {
            id: mergedTask.id,
            originalBaseId: mergedTask.originalBaseId,
            seriesId: mergedTask.seriesId,
            isRepeat: mergedTask.isRepeat,
            _updateSeries: mergedTask._updateSeries,
            _editScope: mergedTask._editScope
          });
          
          // Find the base task
          const baseTask = tasks.all.find(t => t.id === mergedTask.originalBaseId);
          console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Base task search result:', baseTask ? 'FOUND' : 'NOT FOUND');
          if (!baseTask) {
            console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Base task not found! Available tasks in all collection:', tasks.all.map(t => ({ id: t.id, title: t.title, isRepeat: t.isRepeat })));
          }
          if (baseTask) {
            console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Base task details:', {
              id: baseTask.id,
              title: baseTask.title,
              seriesId: baseTask.seriesId,
              isRepeat: baseTask.isRepeat,
              repeat: baseTask.repeat
            });
            
            // Series updates are now handled earlier in the function
            // This section only handles non-series updates for instances

            
            if (newTagId !== null && originalTagId !== newTagId) {
              console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Non-series update: only updating tag on base task');
              console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Original tag ID:', originalTagId);
              console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] New tag ID:', newTagId);
              
              // Non-series update: only update tag on base task
              baseTask.tag = cleanedTask.tag;
              console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Updated base task tag to:', baseTask.tag);
              
              // Update base task in its tag collection
              if (baseTask.tag && baseTask.tag.id) {
                const baseTagId = baseTask.tag.id;
                console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Moving base task to tag collection:', baseTagId);
                if (!tasks[baseTagId]) tasks[baseTagId] = [];
                
                // Remove from old tag collection
                if (originalTagId && tasks[originalTagId]) {
                  const beforeCount = tasks[originalTagId].length;
                  tasks[originalTagId] = tasks[originalTagId].filter(t => t.id !== baseTask.id);
                  console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Removed base task from old tag collection. Count:', beforeCount, '->', tasks[originalTagId].length);
                }
                
                // Add to new tag collection if not already there
                if (!tasks[baseTagId].find(t => t.id === baseTask.id)) {
                  tasks[baseTagId].push(baseTask);
                  console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Added base task to new tag collection. Count:', tasks[baseTagId].length);
                } else {
                  console.log('🔥 CHRONO_DEBUG_SERIES [INSTANCE UPDATE] Base task already exists in new tag collection');
                }
              }
            }
          }
        }
      }
      
      // Handle tag changes for non-recurring tasks - we need to move the task between collections
      if (!mergedTask.repeat || mergedTask.repeat === 'none') {
        if (originalTagId !== newTagId) {
          console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] Tag has changed, moving task between collections');
          console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] Original tag:', originalTagId);
          console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] New tag:', newTagId);
          console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] Task ID:', updatedTaskData.id);
          
          // Remove the task from all collections except 'all'
          for (const groupKey in tasks) {
            if (groupKey !== 'all' && Array.isArray(tasks[groupKey])) {
              tasks[groupKey] = tasks[groupKey].filter(t => t.id !== updatedTaskData.id);
            }
          }
          
          // Add to new tag collection if it has a new tag
          if (newTagId) {
            if (!tasks[newTagId]) tasks[newTagId] = [];
            // Check if task already exists in the new tag collection to prevent duplicates
            const existsInNewTag = tasks[newTagId].some(t => t.id === updatedTaskData.id);
            if (!existsInNewTag) {
              tasks[newTagId].push(cleanedTask);
              console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] Added task to new tag collection:', newTagId);
              console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] New tag collection size:', tasks[newTagId].length);
            } else {
              console.log('🔥 CHRONO_DEBUG_SERIES [TAG CHANGE] Task already exists in new tag collection:', newTagId);
            }
          }
        } else {
          // Tag hasn't changed, but we still need to update the task in its existing tag collection
          if (originalTagId && tasks[originalTagId]) {
            const tagTaskIndex = tasks[originalTagId].findIndex(t => t.id === updatedTaskData.id);
            if (tagTaskIndex !== -1) {
              tasks[originalTagId][tagTaskIndex] = cleanedTask;
              console.log(`Updated task in existing tag collection: ${originalTagId}`);
            }
          }
        }
      }
      
      // Update the task in the 'all' collection
      const allTaskIndex = tasks.all ? tasks.all.findIndex(t => t.id === updatedTaskData.id) : -1;
      if (allTaskIndex !== -1) {
        tasks.all[allTaskIndex] = cleanedTask;
        console.log('Updated task in all collection');
      } else {
        // Only add to 'all' collection if it's truly a new task that doesn't exist
        // This should not happen in normal update flow, but handle edge cases
        console.warn('Task not found in all collection during update, this might indicate an issue');
        if (!tasks.all) tasks.all = [];
        tasks.all.push(cleanedTask);
        console.log('Added missing task to all collection');
      }
      
      // Check if this was a series-wide update that already saved to localStorage
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Final save check - seriesUpdateResult:', seriesUpdateResult);
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Final tasks.all count:', tasks.all.length);
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Final tasks object keys:', Object.keys(tasks));
      
      if (typeof seriesUpdateResult === 'object' && seriesUpdateResult && seriesUpdateResult.seriesUpdateCompleted) {
        console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Series-wide update already completed, skipping final save');
        console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] SKIPPING final save because series update completed');
        return true;
      }
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] PROCEEDING with final save - no series update or series update did not complete');

      localStorage.setItem("tasks", JSON.stringify(tasks));
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Saved tasks to localStorage');
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Final saved tasks.all count:', tasks.all.length);
      
      // Dispatch both event types that components listen to
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      
      // Dispatch the tasks-updated event that Sidebar listens to
      window.dispatchEvent(new CustomEvent('tasks-updated', {
        detail: tasks
      }));
      
      // Dispatch the tasksUpdated event for compatibility
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: tasks } // Send the fully updated tasks object
      }));
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Dispatched storage and tasksUpdated events');
      
      console.log('🔥 CHRONO_DEBUG_SERIES [FINAL SAVE] Update task completed successfully');
      return true;
    } catch (error) {
      console.error('🔥 CHRONO_DEBUG_SERIES [ERROR] Update task failed with error:', error);
      console.error('🔥 CHRONO_DEBUG_SERIES [ERROR] Error stack:', error.stack);
      return false;
    }
  }, []);

  const handleToggleTaskCompletion = useCallback((taskOrId, scope = 'single') => {
    console.log('[COMPLETION DEBUG] handleToggleTaskCompletion called with:', { taskOrId, scope });
    
    try {
      const savedTasks = localStorage.getItem("tasks") || "{}";
      const tasks = JSON.parse(savedTasks);
      
      // Handle both task object and task ID
      let taskToComplete;
      if (typeof taskOrId === 'string') {
        // Find task by ID in both active and completed collections
        taskToComplete = tasks.all?.find(t => t.id === taskOrId) || 
                        tasks.completed?.find(t => t.id === taskOrId);
        if (!taskToComplete) {
          console.error('[COMPLETION DEBUG] Task not found with ID:', taskOrId);
          return false;
        }
      } else {
        taskToComplete = taskOrId;
      }
      
      console.log('[COMPLETION DEBUG] Task to complete:', {
        id: taskToComplete.id,
        title: taskToComplete.title,
        isRepeat: taskToComplete.isRepeat,
        seriesId: taskToComplete.seriesId,
        completed: taskToComplete.completed
      });
      
      // Toggle completion status
      const newCompletedStatus = !taskToComplete.completed;
      
      // Handle completed tasks by moving them to the completed collection
      if (newCompletedStatus) {
        // Task is being completed
        const completedTask = { ...taskToComplete, completed: true, completedAt: new Date().toISOString() };
        
        // Initialize completed array if it doesn't exist
        if (!tasks.completed) {
          tasks.completed = [];
        }
        
        // Add to completed collection if not already there
        const existingCompletedIndex = tasks.completed.findIndex(t => t.id === taskToComplete.id);
        if (existingCompletedIndex === -1) {
          tasks.completed.push(completedTask);
        } else {
          tasks.completed[existingCompletedIndex] = completedTask;
        }
        
        // Remove from active collections
        tasks.all = tasks.all.filter(t => t.id !== taskToComplete.id);
        Object.keys(tasks).forEach(key => {
          if (key !== 'all' && key !== 'completed' && Array.isArray(tasks[key])) {
            tasks[key] = tasks[key].filter(t => t.id !== taskToComplete.id);
          }
        });
      } else {
        // Task is being uncompleted - move back to active collections
        const activeTask = { ...taskToComplete, completed: false };
        delete activeTask.completedAt;
        
        // If this was a recurring task instance, make it a detached instance
        if (activeTask.isRepeat === true && activeTask.seriesId) {
          console.log('[COMPLETION DEBUG] Creating detached instance for uncompleted recurring task');
          // Remove series connection to make it a standalone task
          delete activeTask.seriesId;
          delete activeTask.originalBaseId;
          delete activeTask.repeat; // Remove repeat property so it doesn't show as recurring
          delete activeTask.rruleOptions; // Remove any custom recurrence rules
          delete activeTask.startDateOfSeries; // Remove series start date
          activeTask.isRepeat = false;
          // Generate a new unique ID for the detached instance
          activeTask.id = `detached_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Remove from completed collection
        if (tasks.completed) {
          tasks.completed = tasks.completed.filter(t => t.id !== taskToComplete.id);
        }
        
        // Add back to active collections
        if (!tasks.all) tasks.all = [];
        tasks.all.push(activeTask);
        
        // Add to tag-specific collection if task has a tag
        if (activeTask.tag && activeTask.tag.id) {
          if (!tasks[activeTask.tag.id]) tasks[activeTask.tag.id] = [];
          tasks[activeTask.tag.id].push(activeTask);
        }
      }
      
      // If this is a recurring task instance being completed, generate next instance
      if (newCompletedStatus && taskToComplete.isRepeat === true && taskToComplete.seriesId) {
        console.log('[COMPLETION DEBUG] Generating next instance for completed recurring task');
        
        // Find the base task
        const baseTask = tasks.all.find(t => t.seriesId === taskToComplete.seriesId && (t.isRepeat === false || typeof t.isRepeat === 'undefined'));
        
        if (baseTask && baseTask.repeat && baseTask.repeat !== 'none') {
          console.log('[COMPLETION DEBUG] Base task found:', {
            id: baseTask.id,
            title: baseTask.title,
            repeat: baseTask.repeat,
            seriesId: baseTask.seriesId
          });
          
          // Generate next instance
          const nextDate = getNextRecurrenceDate(
            taskToComplete.scheduledDate, 
            baseTask.repeat,
            baseTask.rruleOptions // Pass rruleOptions for custom patterns
          );
          
          if (nextDate) {
            const nextInstanceId = `${baseTask.seriesId}_${nextDate}`;
            
            // Check if next instance already exists
            const existingNextInstance = tasks.all.find(t => t.id === nextInstanceId);
            
            if (!existingNextInstance) {
              console.log('[COMPLETION DEBUG] Creating next instance with date:', nextDate);
              
              const nextInstance = {
                ...baseTask,
                id: nextInstanceId,
                scheduledDate: nextDate,
                isRepeat: true,
                originalBaseId: baseTask.id,
                completed: false,
                createdAt: new Date().toISOString()
              };
              
              // Add to all collection
              tasks.all.push(nextInstance);
              
              // Add to tag collection if task has a tag
              if (nextInstance.tag && nextInstance.tag.id && tasks[nextInstance.tag.id]) {
                tasks[nextInstance.tag.id].push(nextInstance);
              }
              
              console.log('[COMPLETION DEBUG] Next instance created:', {
                id: nextInstance.id,
                scheduledDate: nextInstance.scheduledDate,
                title: nextInstance.title
              });
            } else {
              console.log('[COMPLETION DEBUG] Next instance already exists:', nextInstanceId);
            }
          }
        }
      }
      
      // Save to localStorage
      localStorage.setItem("tasks", JSON.stringify(tasks));
      
      // Dispatch both event types that components listen to
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      
      // Dispatch the tasks-updated event that Sidebar listens to
      window.dispatchEvent(new CustomEvent('tasks-updated', {
        detail: tasks
      }));
      
      // Dispatch the tasksUpdated event for compatibility
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: tasks }
      }));
      
      console.log('[COMPLETION DEBUG] Task completion handled successfully');
      return true;
      
    } catch (error) {
      console.error('[COMPLETION DEBUG] Error in handleToggleTaskCompletion:', error);
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
        // Check if there's already an instance for the expected first occurrence date
        // to prevent creating duplicates when addTask just created one
        if (!baseTask.startDateOfSeries && baseTask.scheduledDate) {
          baseTask.startDateOfSeries = baseTask.scheduledDate;
        } else if (!baseTask.startDateOfSeries && baseTask.createdAt) {
          baseTask.startDateOfSeries = baseTask.createdAt;
        } else if (!baseTask.startDateOfSeries) {
          baseTask.startDateOfSeries = new Date().toISOString(); 
        }

        let rawFirstInstance = generateNextDisplayableTaskInstance(baseTask, null); 
        
        if (rawFirstInstance) {
          const expectedInstanceId = `${baseTask.seriesId}_repeat_${new Date(rawFirstInstance.scheduledDate).getTime()}`;
          
          // Check if an instance with this ID or scheduled date already exists
          const instanceAlreadyExists = existingInstancesForSeries.some(instance => 
            instance.id === expectedInstanceId || 
            instance.id === rawFirstInstance.id ||
            (instance.scheduledDate && rawFirstInstance.scheduledDate && 
             new Date(instance.scheduledDate).getTime() === new Date(rawFirstInstance.scheduledDate).getTime())
          );
          
          if (!instanceAlreadyExists) {
            const firstInstance = {
              ...rawFirstInstance,
              seriesId: baseTask.seriesId, 
              isRepeat: true,              
              tag: rawFirstInstance.tag || baseTask.tag, 
              originalBaseId: baseTask.id,     
              id: rawFirstInstance.id && !String(rawFirstInstance.id).includes('undefined') && !String(rawFirstInstance.id).includes('null')
                  ? rawFirstInstance.id 
                  : expectedInstanceId,
              // Ensure scheduledDate is in ISO format if it's a Date object
              scheduledDate: rawFirstInstance.scheduledDate instanceof Date ? rawFirstInstance.scheduledDate.toISOString() : rawFirstInstance.scheduledDate
            };

            console.log('[CREATION DEBUG] ensureActive adding instance:', {
              instanceId: firstInstance.id,
              seriesId: firstInstance.seriesId,
              scheduledDate: firstInstance.scheduledDate,
              timestamp: new Date().toISOString()
            });

            const tagGroup = firstInstance.tag ? firstInstance.tag.id : "all";
            if (!tasks[tagGroup]) tasks[tagGroup] = [];
            if (!tasks[tagGroup].some(t => t.id === firstInstance.id)) {
              tasks[tagGroup].push(firstInstance);
            }
            
            if (!tasks.all.some(t => t.id === firstInstance.id)) {
               tasks.all.push(firstInstance);
               updated = true;
            }
          } else {
            console.log('[CREATION DEBUG] ensureActive skipping - instance exists:', {
              seriesId: baseTask.seriesId,
              expectedInstanceId,
              timestamp: new Date().toISOString()
            });
          }
        }
      }
    });

    if (updated) {

      localStorage.setItem("tasks", JSON.stringify(tasks));
      
      // Dispatch both event types that components listen to
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'tasks',
        newValue: JSON.stringify(tasks),
        url: window.location.href
      }));
      
      // Dispatch the tasks-updated event that Sidebar listens to
      window.dispatchEvent(new CustomEvent('tasks-updated', {
        detail: tasks
      }));
      
      // Dispatch the tasksUpdated event for compatibility
      window.dispatchEvent(new CustomEvent('tasksUpdated', {
        detail: { tasks: tasks }
      }));
    } else {

    }
  }, [generateNextDisplayableTaskInstance]); // Added generateNextDisplayableTaskInstance to dependency array

  // Use a ref to ensure ensureActiveRecurringInstances only runs once across all component instances
  const hasInitialized = useRef(false);
  
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      ensureActiveRecurringInstances();
    }
  }, []); // Empty dependency array to run only once per hook instance

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
