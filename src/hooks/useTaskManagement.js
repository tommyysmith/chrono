import { generateRecurringTasks } from '../utils/recurrenceUtils';

export function useTaskManagement() {
  /**
   * Get all tasks in a series
   * @param {Array} allTasks - All tasks
   * @param {string} seriesId - The series ID to filter by
   * @returns {Array} Tasks in the series
   */
  const getTasksInSeries = (allTasks, seriesId) => {
    if (!seriesId) return [];
    return allTasks.filter(task => task.seriesId === seriesId);
  };

  const handleCreateTask = (task) => {
    // Store the task in localStorage
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);

    // Add task to its tag group and the 'all' group
    const tagGroup = task.tag ? task.tag.id : "all";
    const updatedTasks = {
      ...tasks,
      [tagGroup]: [...(tasks[tagGroup] || []), task],
      all: [...(tasks.all || []), task],
    };
    
    // If this is a recurring task, generate instances but don't store them
    // They will be generated on-demand when needed
    if (task.repeat && task.repeat !== 'none') {
      // Make sure the task has a seriesId
      if (!task.seriesId) {
        task.seriesId = `series_${Date.now().toString()}`;
        // Update the task in the collections
        updatedTasks[tagGroup] = updatedTasks[tagGroup].map(t => 
          t.id === task.id ? {...t, seriesId: task.seriesId} : t
        );
        updatedTasks.all = updatedTasks.all.map(t => 
          t.id === task.id ? {...t, seriesId: task.seriesId} : t
        );
      }
    }

    // Save back to localStorage
    localStorage.setItem("tasks", JSON.stringify(updatedTasks));
  };

  const handleUpdateTask = (task) => {
    // Get current tasks from localStorage
    const savedTasks = localStorage.getItem("tasks") || "{}";
    const tasks = JSON.parse(savedTasks);

    // Find the task with matching ID in any of the tag groups
    const filteredTask = Object.values(tasks)
      .flat()
      .find((t) => t.id === task.id);

    // Merge filteredTask with the new task data, prioritizing new task data
    // but keeping original values for fields not specified in the update
    const mergedTask = filteredTask ? { ...filteredTask, ...task } : task;

    // Check if this is a recurring task and if the repeat pattern has changed
    const repeatChanged = filteredTask && 
                         filteredTask.repeat !== mergedTask.repeat;

    // If this is a new recurring task or the repeat pattern changed,
    // make sure it has a seriesId
    if (mergedTask.repeat && mergedTask.repeat !== 'none' && !mergedTask.seriesId) {
      mergedTask.seriesId = `series_${Date.now().toString()}`;
    }

    // Determine the tag group for the updated task
    const tagGroup = task.tag ? task.tag.id : "all";

    // Create updated tasks object by filtering out the old task from all groups
    // and adding the merged task to the appropriate groups
    const updatedTasks = Object.keys(tasks).reduce((acc, key) => {
      // Check if tasks[key] is an array before filtering
      if (Array.isArray(tasks[key])) {
        // Remove the task with matching ID from each group
        acc[key] = tasks[key].filter((t) => t.id !== task.id);

        // Add the merged task to its tag group and the 'all' group
        if (key === tagGroup || key === "all") {
          acc[key].push(mergedTask);
        }
      } else {
        // If not an array, initialize as an empty array
        acc[key] = [];

        // Add the merged task if this is its tag group or 'all'
        if (key === tagGroup || key === "all") {
          acc[key].push(mergedTask);
        }
      }

      return acc;
    }, {});

    // If this is a recurring task series and the repeat pattern changed,
    // we need to update all tasks in the series
    if (mergedTask.seriesId && repeatChanged) {
      // Find all tasks in the series
      const seriesTasks = getTasksInSeries(Object.values(tasks).flat(), mergedTask.seriesId);
      
      // Update each task in the series with the new repeat pattern
      seriesTasks.forEach(seriesTask => {
        if (seriesTask.id !== mergedTask.id) {
          // Update the repeat pattern for all tasks in the series
          const updatedSeriesTask = {
            ...seriesTask,
            repeat: mergedTask.repeat
          };
          
          // Update the task in all collections
          Object.keys(updatedTasks).forEach(key => {
            if (Array.isArray(updatedTasks[key])) {
              updatedTasks[key] = updatedTasks[key].map(t => 
                t.id === seriesTask.id ? updatedSeriesTask : t
              );
            }
          });
        }
      });
    }

    // Save back to localStorage
    localStorage.setItem("tasks", JSON.stringify(updatedTasks));
  };

  /**
   * Get all recurring task instances for a given time range
   * @param {Date} startDate - Start of the range
   * @param {Date} endDate - End of the range
   * @returns {Array} Array of recurring task instances
   */
  const getRecurringTaskInstances = (startDate, endDate) => {
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
  };

  return {
    handleCreateTask,
    handleUpdateTask,
    getTasksInSeries,
    getRecurringTaskInstances
  };
}
