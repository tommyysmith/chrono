export function useTaskManagement() {
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

    // Save back to localStorage
    localStorage.setItem("tasks", JSON.stringify(updatedTasks));
  };

  const handleUpdateTask = (task) => {
    //believe this can be edited to a filter based on ID
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

    // Save back to localStorage
    localStorage.setItem("tasks", JSON.stringify(updatedTasks));
  };

  return {
    handleCreateTask,
    handleUpdateTask,
  };
}
