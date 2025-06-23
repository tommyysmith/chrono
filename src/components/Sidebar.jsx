"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { format, isToday, isTomorrow, isPast, isAfter, parseISO, addDays } from "date-fns";
import { useTaskManagement } from "../hooks/useTaskManagement";
import { Completed } from "../assets/icons/Completed";
import { Check } from "../assets/icons/Check"; 
import { Edit } from "../assets/icons/Edit";
// import ThemeToggle from '../components/ThemeToggle';
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import TagDropdown from "./TagDropdown";
import TaskItem from "./TaskItem";
import Checkbox from "./Checkbox";
import RepeatTaskEditModal from "./RepeatTaskEditModal";
import { TAG_COLORS } from "../constants/colors";
import { Chevron } from "../assets/icons/Chevron";
import { Calendar } from "../assets/icons/Calendar";
import { Tomorrow } from "../assets/icons/Tomorrow";
import { Soon } from "../assets/icons/Soon";
import { Inbox as InboxAlt } from "../assets/icons/InboxAlt";
import { Clock as ClockIcon } from "../assets/icons/Clock";
import { Tag } from "../assets/icons/Tag";
import { Flag } from "../assets/icons/Flag";
import { Add } from "../assets/icons/Add";
import { Task } from "../assets/icons/Task";
import { Clipboard } from "../assets/icons/Clipboard";
import { SidebarIcon } from "../assets/icons/Sidebar";
import { Inbox as InboxIcon } from "../assets/icons/Inbox";
import { Trash } from "../assets/icons/Trash";
import AgendaView from "./AgendaView";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { More } from "../assets/icons/More";
import { createPortal } from 'react-dom';
import TodaysTasksProgress from './TodaysTasksProgress';

export default function Sidebar({
  commandBarRef,
  events = [],
  selectedDate,
  onDateSelect,
  setIsVisible,
  showTodaysTasks = true,
}) {
  // Get task management functions
  const { 
    getTasksInSeries, 
    getRecurringTaskInstances, 
    handleToggleTaskCompletion, 
    ensureActiveRecurringInstances,
    handleUpdateTask
  } = useTaskManagement();
  const [activeTab, setActiveTab] = useState(() => {
    // Try to load from localStorage first (only in browser)
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem("activeTab");
      if (savedTab) {
        try {
          return savedTab;
        } catch (e) {
          // Error parsing activeTab
        }
      }
    }

    // Default to 'tasks' if no saved state
    return "tasks";
  }); // 'tasks' or 'agenda'

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("activeTab", activeTab);
    }
  }, [activeTab]);

  const [expandedSections, setExpandedSections] = useState(() => {
    // Try to load from localStorage first (only in browser)
    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem("expandedSections");
      if (savedState) {
        try {
          return JSON.parse(savedState);
        } catch (e) {
          // Error parsing expandedSections
        }
      }
    }

    // Initialize with default sections expanded if no saved state
    return {
      overdue: true,
      dueToday: true,
      dueTomorrow: true,
      dueSoon: true,
      today: true,
      scheduled: false,
      tags: false,
      all: true,
      work: true,
      family: true,
      personal: true,
      travel: true,
    };
  });

  // Save expandedSections to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("expandedSections", JSON.stringify(expandedSections));
    }
  }, [expandedSections]);



  const [selectedView, setSelectedView] = useState("all"); // 'all', 'today', 'upcoming', or 'completed'
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState(null);
  const [pendingTag, setPendingTag] = useState(null);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const [colorMenuPosition, setColorMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedTagId, setSelectedTagId] = useState(null);
  const [tags, setTags] = useState(() => {
    // Initialize with default tags
    const defaultTags = [
      { id: "work", label: "Work", color: "#EF4444" },
      { id: "family", label: "Family", color: "#3B82F6" },
      { id: "personal", label: "Personal", color: "#A855F7" },
      { id: "travel", label: "Travel", color: "#22C55E" },
    ];

    // Try to load from localStorage (only in browser)
    if (typeof window !== 'undefined') {
      const savedTags = localStorage.getItem("tags");
      if (savedTags) {
        try {
          return JSON.parse(savedTags);
        } catch (e) {
          // Error parsing tags
        }
      }
    }
    return defaultTags;
  });
  const [tasks, setTasks] = useState(() => {
    // Initialize with empty collections
    const initialTasks = {
      today: [],
      scheduled: {},
      work: [],
      family: [],
      personal: [],
      travel: [],
      all: [],
      completed: [], // New collection for completed tasks
    };

    // Try to load from localStorage (only in browser)
    if (typeof window !== 'undefined') {
      const savedTasks = localStorage.getItem("tasks");
      if (savedTasks) {
        try {
          const parsed = JSON.parse(savedTasks);
          return {
            ...initialTasks,
            ...parsed,
          };
        } catch (e) {
          // Error parsing tasks
        }
      }
    }
    return initialTasks;
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [originalTask, setOriginalTask] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [commandBarSelectedTasks, setCommandBarSelectedTasks] = useState(new Set());
  
  // Sync CommandBar selected tasks with local state using callbacks
  useEffect(() => {
    console.log('[Sidebar] Selection callback useEffect triggered');
    if (commandBarRef?.current?.onSelectionChange) {
      console.log('[Sidebar] Registering selection callback');
      const unsubscribe = commandBarRef.current.onSelectionChange((selectedTaskIds) => {
        console.log('[Sidebar] Selection callback executed with:', selectedTaskIds.length, 'tasks');
        setTimeout(() => {
          setCommandBarSelectedTasks(new Set(selectedTaskIds));
        }, 0);
      });
      
      // Initial sync
      if (commandBarRef?.current?.getSelectedTasks) {
        const selectedTasks = commandBarRef.current.getSelectedTasks();
        console.log('[Sidebar] Initial sync with:', selectedTasks.length, 'tasks');
        setTimeout(() => {
          setCommandBarSelectedTasks(new Set(selectedTasks));
        }, 0);
      }
      
      return () => {
        console.log('[Sidebar] Unregistering selection callback');
        unsubscribe();
      };
    }
  }, []);

  // Clear selectedTaskId when clicking outside task items
  useEffect(() => {
    const handleGlobalClick = (event) => {
      const isTaskItem = event.target.closest('[data-task-item]');
      const isMultiSelectToolbar = event.target.closest('[data-multiselect-toolbar]');
      const isCommandBar = event.target.closest('[data-command-bar]');
      
      // If click is outside task items, toolbar, and command bar, clear selection
      if (!isTaskItem && !isMultiSelectToolbar && !isCommandBar) {
        setSelectedTaskId(null);
        // Also clear CommandBar selection
        if (commandBarRef?.current?.clearSelection) {
          commandBarRef.current.clearSelection();
        }
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []); // Empty dependency array is correct - refs are stable and don't need to be in dependencies
  
  // RepeatTaskEditModal state
  const [isRepeatTaskEditModalOpen, setIsRepeatTaskEditModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [draggedTask, setDraggedTask] = useState(null);
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");

  // Save tasks to localStorage whenever they change (throttled)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[Sidebar] Tasks changed, saving to localStorage');
      const timeoutId = setTimeout(() => {
        localStorage.setItem("tasks", JSON.stringify(tasks));
      }, 100); // Throttle localStorage saves
      
      return () => clearTimeout(timeoutId);
    }
  }, [tasks]);

  // Save tags to localStorage whenever they change (throttled)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('[Sidebar] Tags changed, saving to localStorage');
      const timeoutId = setTimeout(() => {
        localStorage.setItem("tags", JSON.stringify(tags));
      }, 100); // Throttle localStorage saves
      
      return () => clearTimeout(timeoutId);
    }
  }, [tags]);

  // Note: ensureActiveRecurringInstances is now handled automatically by useTaskManagement
  // No need to call it manually from components to avoid race conditions and duplicates
  useEffect(() => {
    // Reload tasks from local storage on mount
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        // Preserve structure of initialTasks if needed, or merge carefully.
        setTasks(prevTasks => ({ ...prevTasks, ...parsed })); 
      } catch (e) {
        // Error parsing tasks on mount
      }
    }
  }, []); // Empty dependency array since we only want this to run on mount

  // Listen for tags-updated event from CommandBar
  useEffect(() => {
    const handleTagsUpdated = (event) => {
      // Update tags state when event is received
      setTags(event.detail);

      // Ensure all tags have an expansion state and persist it
      setExpandedSections((prev) => {
        const updated = { ...prev };
        event.detail.forEach((tag) => {
          if (!(tag.id in updated)) {
            updated[tag.id] = true; // New tags start expanded
          }
        });
        // Save to localStorage immediately to ensure persistence
        localStorage.setItem("expandedSections", JSON.stringify(updated));
        return updated;
      });
    };

    // Add event listener
    window.addEventListener("tags-updated", handleTagsUpdated);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener("tags-updated", handleTagsUpdated);
    };
  }, []);

  // Listen for tasks-updated event from CommandBar and tasksUpdated from useTaskManagement
  useEffect(() => {
    const handleTasksUpdated = (event) => {
      // Update tasks state when event is received
      // Handle both event.detail and event.detail.tasks formats
      const newTasks = event.detail.tasks || event.detail;
      setTasks(newTasks);
    };

    // Add event listeners for both event types
    window.addEventListener("tasks-updated", handleTasksUpdated);
    window.addEventListener("tasksUpdated", handleTasksUpdated);

    // Clean up event listeners on component unmount
    return () => {
      window.removeEventListener("tasks-updated", handleTasksUpdated);
      window.removeEventListener("tasksUpdated", handleTasksUpdated);
    };
  }, []);

  const [draftSchedule, setDraftSchedule] = useState(null);

  // Add isEditing state
  const [isEditing, setIsEditing] = useState(false);

  // Modify scheduling handlers
  const handleScheduleChange = useCallback(
    (taskId, newSchedule) => {
      if (!isEditing) {
        // Apply changes immediately if not in edit mode
        setTasks((prevTasks) => {
          const updatedTasks = { ...prevTasks };
          Object.keys(updatedTasks).forEach((group) => {
            updatedTasks[group] = updatedTasks[group].map((task) =>
              task.id === taskId ? { ...task, ...newSchedule } : task
            );
          });
          localStorage.setItem("tasks", JSON.stringify(updatedTasks));
          return updatedTasks;
        });
      } else {
        // Store changes in draft state when in edit mode
        setDraftSchedule({ taskId, ...newSchedule });
      }
    },
    [isEditing]
  );

  const applyScheduleChanges = useCallback(() => {
    if (draftSchedule) {
      const { taskId, ...schedule } = draftSchedule;
      setTasks((prevTasks) => {
        const updatedTasks = { ...prevTasks };
        Object.keys(updatedTasks).forEach((group) => {
          updatedTasks[group] = updatedTasks[group].map((task) =>
            task.id === taskId ? { ...task, ...schedule } : task
          );
        });
        localStorage.setItem("tasks", JSON.stringify(updatedTasks));
        return updatedTasks;
      });
      setDraftSchedule(null);
    }
  }, [draftSchedule]);

  const addTaskRef = useRef(null);
  const taskInputRef = useRef(null);

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleClose = () => {
    setIsAddingTask(false);
    setTaskTitle("");
    setSelectedTag(null);
    setIsTagDropdownOpen(false);
  };

  const handleAddTask = (newTask) => {
    // Use the hook's createTask, assuming it handles localStorage and state updates
    // For now, will keep local state management and assume hook updates localStorage
    // This might need refinement if Sidebar's local `tasks` state doesn't auto-update
    // from localStorage changes made by the hook.

    const tagId = newTask.tag ? newTask.tag.id : "all";
    const newId = `task-${Date.now()}`;
    const taskWithId = { ...newTask, id: newId, completed: false };

    setTasks((prevTasks) => {
      const updatedGroup = [...(prevTasks[tagId] || []), taskWithId];
      const updatedAll = [...(prevTasks.all || []), taskWithId];
      return {
        ...prevTasks,
        [tagId]: updatedGroup,
        all: updatedAll,
      };
    });

    // If using useTaskManagement's createTask, it would be something like:
    // createTask(taskWithId); // And then rely on state propagation or re-fetching
  };

  const handleEditTask = (updatedTask) => {
    setTasks((prevTasks) => {
      const newTasks = { ...prevTasks };
      let found = false;
      // Update in specific tag group
      if (updatedTask.tag && newTasks[updatedTask.tag.id]) {
        newTasks[updatedTask.tag.id] = newTasks[updatedTask.tag.id].map((task) =>
          task.id === updatedTask.id ? updatedTask : task
        );
        found = newTasks[updatedTask.tag.id].some(t => t.id === updatedTask.id);
      }
      // Update in 'all' group
      if (newTasks.all) {
        newTasks.all = newTasks.all.map((task) =>
          task.id === updatedTask.id ? updatedTask : task
        );
      }
      // If task was moved from a group or untagged, it might not be found in the new tag group
      // This part of the logic needs to be robust to handle tag changes correctly.
      // For simplicity, current update assumes tag doesn't change or is handled by `updatedTask` object.
      return newTasks;
    });
    setEditingTaskId(null);
  };

  const handleDeleteTask = (taskId, scope = 'single') => {
    
    setTasks((prev) => {
      const newTasks = { ...prev };
      
      // Find the task to delete
      let taskToDelete = null;
      let taskSeriesId = null;
      let taskScheduledDate = null;
      
      // Find the task in any collection
      Object.keys(newTasks).forEach((group) => {
        if (Array.isArray(newTasks[group])) {
          const foundTask = newTasks[group].find(task => task.id === taskId);
          if (foundTask && !taskToDelete) {
            taskToDelete = foundTask;
            taskSeriesId = foundTask.seriesId;
            taskScheduledDate = foundTask.scheduledDate;
          }
        }
      });
      
      
      if (!taskToDelete) {
        return prev; // No changes if task not found
      }
      
      // Strengthen instance detection logic
      const isRecurringInstance = taskToDelete.isRepeat === true || 
                                 (taskSeriesId && taskToDelete.originalBaseId) ||
                                 (taskSeriesId && taskToDelete.id && taskToDelete.id.includes('_repeat_'));
      
      // Additional check: if task has seriesId but no explicit isRepeat, it's likely an instance
      const isLikelyInstance = taskSeriesId && !taskToDelete.repeat && taskToDelete.id !== taskSeriesId;
      


      // Handle different deletion scopes
      if (taskSeriesId && scope === 'all') {
        // For 'all' scope, delete all tasks in the series
        Object.keys(newTasks).forEach((group) => {
          if (Array.isArray(newTasks[group])) {
            newTasks[group] = newTasks[group].filter(
              (task) => task.seriesId !== taskSeriesId
            );
          }
        });
      }
      else if (taskSeriesId && scope === 'future' && taskScheduledDate) {
        // For 'future' scope, delete this task and all future tasks in the series
        const taskDate = new Date(taskScheduledDate);
        
        Object.keys(newTasks).forEach((group) => {
          if (Array.isArray(newTasks[group])) {
            newTasks[group] = newTasks[group].filter(task => {
              // Keep if not in this series
              if (task.seriesId !== taskSeriesId) return true;
              
              // For tasks in this series, keep only if scheduled before this task
              if (task.scheduledDate) {
                const compareDate = new Date(task.scheduledDate);
                return compareDate < taskDate;
              }
              
              // Keep base task definition (not an instance)
              return task.isRepeat === false;
            });
          }
        });
      }
      else if (scope === 'single') {
        
        // For 'single' scope deletion of recurring tasks: Delete the instance and generate next
        if (taskSeriesId && (isRecurringInstance || isLikelyInstance)) {
          
          // Find the base task definition
          const allTasks = Object.values(newTasks)
            .flat()
            .filter(t => t.seriesId === taskSeriesId);
          const baseTaskDefinition = allTasks.find(t => t.isRepeat === false || typeof t.isRepeat === 'undefined');
          
          if (baseTaskDefinition) {
            // Remove the current task from all collections first
            Object.keys(newTasks).forEach((group) => {
              if (Array.isArray(newTasks[group])) {
                newTasks[group] = newTasks[group].filter(
                  (task) => task.id !== taskId
                );
              }
            });
            
            // Handle async operation after the main state update completes
            setTimeout(() => {
              import('../utils/recurrenceUtils').then(({ generateNextDisplayableTaskInstance }) => {
                const nextInstance = generateNextDisplayableTaskInstance(baseTaskDefinition, new Date(taskToDelete.scheduledDate));
                
                if (nextInstance) {
                  
                  // Update React state in a separate cycle
                  setTasks(currentTasks => {
                    const updatedTasks = { ...currentTasks };
                    
                    // Check if this exact instance already exists in current state
                    const instanceExists = Object.values(updatedTasks)
                      .flat()
                      .some(t => 
                        t.id === nextInstance.id || 
                        (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                      );
                    
                    if (!instanceExists) {
                      // Add to 'all' collection
                      if (!updatedTasks.all) updatedTasks.all = [];
                      updatedTasks.all.push(nextInstance);
                      
                      // Add to specific tag group if applicable
                      if (nextInstance.tag && nextInstance.tag.id) {
                        const nextInstanceTagGroup = nextInstance.tag.id;
                        if (!updatedTasks[nextInstanceTagGroup]) updatedTasks[nextInstanceTagGroup] = [];
                        updatedTasks[nextInstanceTagGroup].push(nextInstance);
                      }
                      
                      // Add to 'today' collection if scheduled for today
                      if (nextInstance.scheduledDate) {
                        const today = new Date();
                        const instanceDate = new Date(nextInstance.scheduledDate);
                        if (instanceDate.toDateString() === today.toDateString()) {
                          if (!updatedTasks.today) updatedTasks.today = [];
                          updatedTasks.today.push(nextInstance);
                        }
                      }
                      
                      // Save to localStorage and dispatch storage event in separate cycle
                      setTimeout(() => {
                        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
                        window.dispatchEvent(new StorageEvent('storage', {
                          key: 'tasks',
                          newValue: JSON.stringify(updatedTasks),
                          url: window.location.href
                        }));
                      }, 0);
                    }
                    
                    return updatedTasks;
                  });
                } else {
                  // No further instances to generate for series
                }
              }).catch(error => {
                // Error importing generateNextDisplayableTaskInstance
              });
            }, 0);
          } else {
            
            // Find the next instance in the series to promote as the new base task
            const allSeriesInstances = Object.values(newTasks)
              .flat()
              .filter(t => t.seriesId === taskSeriesId && t.id !== taskId)
              .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
            
            if (allSeriesInstances.length > 0) {
              const nextInstance = allSeriesInstances[0];
              
              // Create new base task from the next instance
              const newBaseTask = {
                ...nextInstance,
                id: taskToDelete.originalBaseId || nextInstance.seriesId,
                isRepeat: false,
                originalBaseId: undefined,
                scheduledDate: nextInstance.scheduledDate,
                startDateOfSeries: nextInstance.scheduledDate,
                repeat: taskToDelete.repeat || 'daily', // Preserve original repeat pattern
                rrule: taskToDelete.rrule,
                rruleOptions: taskToDelete.rruleOptions
              };
              
              // Add the new base task to all collections
              if (!newTasks.all) newTasks.all = [];
              newTasks.all.push(newBaseTask);
              
              // Add to specific tag group if applicable
              if (newBaseTask.tag && newBaseTask.tag.id) {
                const tagGroup = newBaseTask.tag.id;
                if (!newTasks[tagGroup]) newTasks[tagGroup] = [];
                newTasks[tagGroup].push(newBaseTask);
              }
              

            } else {
              
              // Create a new base task from the current instance being deleted
              const newBaseTask = {
                ...taskToDelete,
                id: taskToDelete.originalBaseId || taskSeriesId,
                isRepeat: false,
                originalBaseId: undefined,
                scheduledDate: taskToDelete.scheduledDate,
                startDateOfSeries: taskToDelete.scheduledDate,
                // Preserve recurrence properties
                repeat: taskToDelete.repeat || 'daily',
                rrule: taskToDelete.rrule,
                rruleOptions: taskToDelete.rruleOptions
              };
              
              // Add the new base task to all collections
              if (!newTasks.all) newTasks.all = [];
              newTasks.all.push(newBaseTask);
              
              // Add to specific tag group if applicable
              if (newBaseTask.tag && newBaseTask.tag.id) {
                const tagGroup = newBaseTask.tag.id;
                if (!newTasks[tagGroup]) newTasks[tagGroup] = [];
                newTasks[tagGroup].push(newBaseTask);
              }
              

              
              // Generate the next instance asynchronously
              setTimeout(() => {
                import('../utils/recurrenceUtils').then(({ generateNextDisplayableTaskInstance }) => {
                  const nextInstance = generateNextDisplayableTaskInstance(newBaseTask, new Date(taskToDelete.scheduledDate));
                  
                  if (nextInstance) {
                    
                    // Update React state in a separate cycle
                    setTasks(currentTasks => {
                      const updatedTasks = { ...currentTasks };
                      
                      // Check if this exact instance already exists in current state
                      const instanceExists = Object.values(updatedTasks)
                        .flat()
                        .some(t => 
                          t.id === nextInstance.id || 
                          (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                        );
                      
                      if (!instanceExists) {
                        // Add to 'all' collection
                        if (!updatedTasks.all) updatedTasks.all = [];
                        updatedTasks.all.push(nextInstance);
                        
                        // Add to specific tag group if applicable
                        if (nextInstance.tag && nextInstance.tag.id) {
                          const nextInstanceTagGroup = nextInstance.tag.id;
                          if (!updatedTasks[nextInstanceTagGroup]) updatedTasks[nextInstanceTagGroup] = [];
                          updatedTasks[nextInstanceTagGroup].push(nextInstance);
                        }
                        
                        // Add to 'today' collection if scheduled for today
                        if (nextInstance.scheduledDate) {
                          const today = new Date();
                          const instanceDate = new Date(nextInstance.scheduledDate);
                          if (instanceDate.toDateString() === today.toDateString()) {
                            if (!updatedTasks.today) updatedTasks.today = [];
                            updatedTasks.today.push(nextInstance);
                          }
                        }
                        
                        // Save to localStorage
                        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
                        
                        // Dispatch storage event
                        setTimeout(() => {
                          window.dispatchEvent(new StorageEvent('storage', {
                            key: 'tasks',
                            newValue: JSON.stringify(updatedTasks),
                            url: window.location.href
                          }));
                        }, 0);
                      }
                      
                      return updatedTasks;
                    });
                  } else {
                    // No next instance generated, series will end
                      }
                    }).catch(error => {
                      // Error generating next instance
                    });
              }, 0);
            }
            
            // Delete the current instance
            Object.keys(newTasks).forEach((group) => {
              if (Array.isArray(newTasks[group])) {
                newTasks[group] = newTasks[group].filter(
                  (task) => task.id !== taskId
                );
              }
            });
          }
        } else {
          
          // Special handling for base task definitions (isRepeat: false with seriesId)
          // Only treat as base task if it's explicitly marked as non-repeat AND has no originalBaseId
          if (taskSeriesId && taskToDelete.isRepeat === false && !taskToDelete.originalBaseId) {
            
            // Check if there are any active instances of this series
            const hasActiveInstances = Object.values(newTasks)
              .flat()
              .some(t => 
                t.seriesId === taskSeriesId && 
                t.isRepeat === true && 
                !t.completed
              );
            
            if (hasActiveInstances) {
              return prev; // Prevent deletion
            } else {
              
              // Remove the current base task from all collections first
              Object.keys(newTasks).forEach((group) => {
                if (Array.isArray(newTasks[group])) {
                  newTasks[group] = newTasks[group].filter(
                    (task) => task.id !== taskId
                  );
                }
              });
              
              // Generate the next instance using the base task as template
              setTimeout(() => {
                import('../utils/recurrenceUtils').then(({ generateNextDisplayableTaskInstance }) => {
                  const nextInstance = generateNextDisplayableTaskInstance(taskToDelete, new Date(taskToDelete.scheduledDate));
                  
                  if (nextInstance) {
                    
                    // Update React state in a separate cycle
                    setTasks(currentTasks => {
                      const updatedTasks = { ...currentTasks };
                      
                      // Check if this exact instance already exists in current state
                      const instanceExists = Object.values(updatedTasks)
                        .flat()
                        .some(t => 
                          t.id === nextInstance.id || 
                          (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                        );
                      
                      if (!instanceExists) {
                        // Add to 'all' collection
                        updatedTasks.all.push(nextInstance);
                        
                        // Add to tag-specific collection if applicable
                        if (nextInstance.tagId && updatedTasks[nextInstance.tagId]) {
                          updatedTasks[nextInstance.tagId].push(nextInstance);
                        }
                        
                        // Add to 'today' if scheduled for today
                        const today = new Date().toISOString().split('T')[0];
                        const instanceDate = new Date(nextInstance.scheduledDate).toISOString().split('T')[0];
                        if (instanceDate === today) {
                          updatedTasks.today.push(nextInstance);
                        }
                        
                      } else {
                        // Next instance already exists, skipping addition
                      }
                      
                      // Save to localStorage
                      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
                      
                      return updatedTasks;
                    });
                  } else {
                    // No next instance generated for base task
                  }
                }).catch(error => {
                  // Error generating next instance
                });
              }, 0);
              
              // Skip the regular deletion logic below
              return newTasks;
            }
          }
          
          // For non-recurring tasks or base tasks with no active instances, just delete the task
          Object.keys(newTasks).forEach((group) => {
            if (Array.isArray(newTasks[group])) {
              newTasks[group] = newTasks[group].filter(
                (task) => task.id !== taskId
              );
            }
          });
        }
      }
      // For other cases (continuation logic for recurring instances) - but NOT for 'single' scope
        else if (scope !== 'single') {
          // Only generate next instance if:
          // 1. We're deleting a recurring INSTANCE (using enhanced detection), not the base task
          // 2. There's a valid base task definition to generate from
          if (taskSeriesId && (isRecurringInstance || isLikelyInstance)) {
           
           // Find the base task definition
           const allTasks = Object.values(newTasks).flat();
           const candidateTasks = allTasks.filter(t => t.seriesId === taskSeriesId);
           const baseTaskDefinition = candidateTasks.find(t => t.isRepeat === false || typeof t.isRepeat === 'undefined');
          
          if (baseTaskDefinition) {
            // Remove the current task from all collections first
            Object.keys(newTasks).forEach((group) => {
              if (Array.isArray(newTasks[group])) {
                newTasks[group] = newTasks[group].filter(
                  (task) => task.id !== taskId
                );
              }
            });
            
            // Handle async operation after the main state update completes
            setTimeout(() => {
              import('../utils/recurrenceUtils').then(({ generateNextDisplayableTaskInstance }) => {
                const nextInstance = generateNextDisplayableTaskInstance(baseTaskDefinition, new Date(taskToDelete.scheduledDate));
                
                if (nextInstance) {
                  
                  // Update React state in a separate cycle
                  setTasks(currentTasks => {
                    const updatedTasks = { ...currentTasks };
                    
                    // Check if this exact instance already exists in current state
                    const instanceExists = Object.values(updatedTasks)
                      .flat()
                      .some(t => 
                        t.id === nextInstance.id || 
                        (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                      );
                    
                    if (!instanceExists) {
                      // Add to 'all' collection
                      if (!updatedTasks.all) updatedTasks.all = [];
                      updatedTasks.all.push(nextInstance);
                      
                      // Add to specific tag group if applicable
                      if (nextInstance.tag && nextInstance.tag.id) {
                        const nextInstanceTagGroup = nextInstance.tag.id;
                        if (!updatedTasks[nextInstanceTagGroup]) updatedTasks[nextInstanceTagGroup] = [];
                        updatedTasks[nextInstanceTagGroup].push(nextInstance);
                      }
                      
                      // Add to 'today' collection if scheduled for today
                      if (nextInstance.scheduledDate) {
                        const today = new Date();
                        const instanceDate = new Date(nextInstance.scheduledDate);
                        if (instanceDate.toDateString() === today.toDateString()) {
                          if (!updatedTasks.today) updatedTasks.today = [];
                          updatedTasks.today.push(nextInstance);
                          // Added next instance to today collection
                        }
                      }
                      
                      // Save to localStorage and dispatch storage event in separate cycle
                      setTimeout(() => {
                        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
                        window.dispatchEvent(new StorageEvent('storage', {
                          key: 'tasks',
                          newValue: JSON.stringify(updatedTasks),
                          url: window.location.href
                        }));
                      }, 0);
                    }
                    
                    return updatedTasks;
                  });
                } else {
                  // No further instances to generate for series
                }
              }).catch(error => {
                // Error importing generateNextDisplayableTaskInstance
              });
            }, 0);
          }
        }
        // For all other cases (non-recurring tasks, base task definitions, or when no base task found)
        // This handles cases where scope is not 'single' but we couldn't generate a next instance
        else if (scope !== 'single') {
          // Check if this is a recurring instance without a base task
          if (taskSeriesId && (isRecurringInstance || isLikelyInstance)) {
             
             // Find the next instance in the series to promote as the new base task
             const allSeriesInstances = Object.values(newTasks)
               .flat()
               .filter(t => t.seriesId === taskSeriesId && t.id !== taskId)
               .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
             
             if (allSeriesInstances.length > 0) {
              const nextInstance = allSeriesInstances[0];
              
              // Create new base task from the next instance
              const newBaseTask = {
                ...nextInstance,
                id: taskToDelete.originalBaseId || nextInstance.seriesId,
                isRepeat: false,
                originalBaseId: undefined,
                scheduledDate: nextInstance.scheduledDate,
                startDateOfSeries: nextInstance.scheduledDate,
                repeat: taskToDelete.repeat || 'daily', // Preserve original repeat pattern
                rrule: taskToDelete.rrule,
                rruleOptions: taskToDelete.rruleOptions
              };
              
              // Add the new base task to all collections
              if (!newTasks.all) newTasks.all = [];
              newTasks.all.push(newBaseTask);
              
              // Add to specific tag group if applicable
              if (newBaseTask.tag && newBaseTask.tag.id) {
                const tagGroup = newBaseTask.tag.id;
                if (!newTasks[tagGroup]) newTasks[tagGroup] = [];
                newTasks[tagGroup].push(newBaseTask);
              }
              

            } else {
              
              // Create a new base task from the current instance being deleted
              const newBaseTask = {
                ...taskToDelete,
                id: taskToDelete.originalBaseId || taskSeriesId,
                isRepeat: false,
                originalBaseId: undefined,
                scheduledDate: taskToDelete.scheduledDate,
                startDateOfSeries: taskToDelete.scheduledDate,
                // Preserve recurrence properties
                repeat: taskToDelete.repeat || 'daily',
                rrule: taskToDelete.rrule,
                rruleOptions: taskToDelete.rruleOptions
              };
              
              // Add the new base task to all collections
              if (!newTasks.all) newTasks.all = [];
              newTasks.all.push(newBaseTask);
              
              // Add to specific tag group if applicable
              if (newBaseTask.tag && newBaseTask.tag.id) {
                const tagGroup = newBaseTask.tag.id;
                if (!newTasks[tagGroup]) newTasks[tagGroup] = [];
                newTasks[tagGroup].push(newBaseTask);
              }
              

              
              // Generate the next instance asynchronously
              setTimeout(() => {
                import('../utils/recurrenceUtils').then(({ generateNextDisplayableTaskInstance }) => {
                  const nextInstance = generateNextDisplayableTaskInstance(newBaseTask, new Date(taskToDelete.scheduledDate));
                  
                  if (nextInstance) {
                    
                    setTasks(currentTasks => {
                      const updatedTasks = { ...currentTasks };
                      
                      // Check if this exact instance already exists
                      const instanceExists = Object.values(updatedTasks)
                        .flat()
                        .some(t => 
                          t.id === nextInstance.id || 
                          (t.seriesId === nextInstance.seriesId && t.scheduledDate === nextInstance.scheduledDate && !t.completed)
                        );
                      
                      if (!instanceExists) {
                        // Add to 'all' collection
                        if (!updatedTasks.all) updatedTasks.all = [];
                        updatedTasks.all.push(nextInstance);
                        
                        // Add to specific tag group if applicable
                        if (nextInstance.tag && nextInstance.tag.id) {
                          const nextInstanceTagGroup = nextInstance.tag.id;
                          if (!updatedTasks[nextInstanceTagGroup]) updatedTasks[nextInstanceTagGroup] = [];
                          updatedTasks[nextInstanceTagGroup].push(nextInstance);
                        }
                        
                        // Add to 'today' collection if scheduled for today
                        if (nextInstance.scheduledDate) {
                          const today = new Date();
                          const instanceDate = new Date(nextInstance.scheduledDate);
                          if (instanceDate.toDateString() === today.toDateString()) {
                            if (!updatedTasks.today) updatedTasks.today = [];
                            updatedTasks.today.push(nextInstance);
                          }
                        }
                        
                        // Save to localStorage
                        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
                        
                        // Dispatch storage event
                        setTimeout(() => {
                          window.dispatchEvent(new StorageEvent('storage', {
                            key: 'tasks',
                            newValue: JSON.stringify(updatedTasks),
                            url: window.location.href
                          }));
                        }, 0);
                      }
                      
                      return updatedTasks;
                    });
                  } else {
                    // No next instance generated, series will end
                      }
                    }).catch(error => {
                      // Error generating next instance
                    });
              }, 0);
            }
          }
          
          // Remove just this task from all collections
          Object.keys(newTasks).forEach((group) => {
            if (Array.isArray(newTasks[group])) {
              newTasks[group] = newTasks[group].filter(
                (task) => task.id !== taskId
              );
            }
          });
        }
      }
      
      // Save to localStorage immediately
      localStorage.setItem("tasks", JSON.stringify(newTasks));
      
      // Dispatch storage event after state update completes to avoid render cycle conflicts
      setTimeout(() => {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'tasks',
          newValue: JSON.stringify(newTasks),
          url: window.location.href
        }));
      }, 0);
      
      return newTasks;
    });
  };

  // Add an effect to ensure tasks and tags stay in sync with localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      // Allow storage events from same window for useTaskManagement updates
      // Only skip if it's a different type of storage event that could cause cycles
      
      if (e.key === "tasks") {
        try {
          const newTasks = JSON.parse(e.newValue);
          setTasks(newTasks);
        } catch (e) {
          // Error parsing tasks from storage event
        }
      } else if (e.key === "tags") {
        try {
          const newTags = JSON.parse(e.newValue);
          setTags(newTags);
          // Update expandedSections for any custom tags
          setExpandedSections((prev) => {
            const updated = { ...prev };
            newTags.forEach((tag) => {
              if (!(tag.id in updated)) {
                updated[tag.id] = true;
              }
            });
            return updated;
          });
        } catch (e) {
          // Error parsing tags from storage event
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleEditTaskIconClick = (task) => {
    if (commandBarRef?.current) {
      // Check if this is a recurring task (base task with repeat property OR instance with seriesId/isRepeat)
      const isRecurringTask = (task.repeat && task.repeat !== 'none') || task.seriesId || task.isRepeat;
      
      if (isRecurringTask) {
        // Show the RepeatTaskEditModal for recurring tasks
        setTaskToEdit(task);
        setDraggedTask(task); // For recurring tasks, the "dragged" task is the same as original
        setIsRepeatTaskEditModalOpen(true);
      } else {
        // For non-recurring tasks, open the command bar directly
        setEditingTaskId(task.id);
        setOriginalTask(task);
        commandBarRef.current.openForTaskEdit(task);
      }
    }
  };

  // Get all unique tasks with their complete data
  // Processing tasks from state
  
  const allTasks = Object.values(tasks)
    .filter(Array.isArray) // Filter out any non-array values
    .reduce((unique, group) => {
      group.forEach((task) => {
        // Skip completed tasks (they should only appear in the completed tab)
        if (task.completed) {
          return;
        }
        
        // For recurring tasks, we want to handle them specially
        if (task.repeat && task.repeat !== 'none') {
          // For base tasks (isRepeat === false), we should check if there's an active instance
          if (task.isRepeat === false) {
            const hasActiveInstance = Object.values(tasks)
              .filter(Array.isArray)
              .some(taskGroup => 
                taskGroup.some(t => {
                  return t.seriesId === task.seriesId && 
                         t.isRepeat === true && 
                         !t.completed;
                })
              );
            
            if (hasActiveInstance) {
              return; // Skip the base task if an active instance exists
            }
            
            if (!task.scheduledDate && task.repeat && task.repeat !== 'none') {
              task = {
                ...task,
                scheduledDate: new Date().toISOString() 
              };
            }
          }
          
          const existingSeriesInstance = Object.values(unique).find(
            t => t.seriesId === task.seriesId && t.isRepeat && !t.completed
          );
          
          if (existingSeriesInstance) {
            if (task.isRepeat && task.scheduledDate && existingSeriesInstance.scheduledDate) {
              const taskDate = parseISO(task.scheduledDate);
              const existingDate = parseISO(existingSeriesInstance.scheduledDate);
              if (isAfter(existingDate, taskDate)) { // current task is earlier
                delete unique[existingSeriesInstance.id]; // remove later instance
                unique[task.id] = task; // add earlier instance
              } else {
                 // existing instance is earlier or same, so keep it and skip current task
                return; 
              }
            } else if (task.isRepeat) { 
              // if existing is found, and current is an instance, but date issue, prefer existing by default
              return; 
            }
            // If current task is base and existing instance found, base was already skipped if instance active
          } else {
            unique[task.id] = task; // No existing instance, or current task is preferred
          }
          return; // Handled recurring task
        }
        
        // For non-recurring tasks
        unique[task.id] = task;
      });
      return unique;
    }, {});

  const allTasksArray = Object.values(allTasks);
  // All unique, non-completed tasks for display consideration

  // Separate tasks by due date categories
  const todayForComparison = new Date();
  todayForComparison.setHours(0, 0, 0, 0); 
  
  const overdueTasks = allTasksArray.filter(task => {
    if (!task.scheduledDate || task.completed) return false;
    try {
      const taskDate = parseISO(task.scheduledDate);
      return isPast(taskDate) && !isToday(taskDate);
    } catch (error) {
      return false;
    }
  });
  
  const dueTodayTasks = allTasksArray.filter(task => {
    if (!task.scheduledDate || task.completed) return false;
    try {
      const taskDate = parseISO(task.scheduledDate);
      return isToday(taskDate);
    } catch (error) {
      return false;
    }
  });
  
  const dueTomorrowTasks = allTasksArray.filter(task => {
    if (!task.scheduledDate || task.completed) return false;
    try {
      const taskDate = parseISO(task.scheduledDate);
      return isTomorrow(taskDate);
    } catch (error) {
      return false;
    }
  });
  
  const dueSoonTasks = allTasksArray.filter(task => {
    if (!task.scheduledDate || task.completed) return false;
    try {
      const taskDate = parseISO(task.scheduledDate);
      const soonDate = addDays(new Date(), 7); // Next 7 days
      return isAfter(taskDate, new Date()) && !isToday(taskDate) && !isTomorrow(taskDate) && taskDate <= soonDate;
    } catch (error) {
      return false;
    }
  });
  
  const activeTasks = allTasksArray.filter(task => {
    if (task.completed) return false; 
    if (!task.scheduledDate) return true; // No date = active (e.g. anytime)
    try {
      const taskDate = parseISO(task.scheduledDate);
      return isToday(taskDate) || isAfter(taskDate, todayForComparison);
    } catch (error) {
      return true; 
    }
  });
  
  const displayableTasks = activeTasks;

  // Helper function to get priority order for sorting
  const getPriorityOrder = (priority) => {
    switch (priority) {
      case 'High': return 0;
      case 'Medium': return 1;
      case 'Low': return 2;
      case 'None': return 3;
      default: return 4;
    }
  };

  // Helper function to sort tasks by priority then by date
  const sortTasksByPriorityAndDate = (tasks) => {
    return tasks.sort((a, b) => {
      // First sort by priority
      const priorityA = getPriorityOrder(a.priority || 'None');
      const priorityB = getPriorityOrder(b.priority || 'None');
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If priorities are the same, sort by date
      return new Date(a.scheduledDate) - new Date(b.scheduledDate);
    });
  };

  const sections =
    selectedView === "all"
      ? [
          // Overdue section
          {
            id: "overdue",
            label: "Overdue",
            icon: ClockIcon,
            color: "#EF4444",
            count: overdueTasks.length,
            tasks: sortTasksByPriorityAndDate(overdueTasks),
          },
          // Due today section
          {
            id: "dueToday",
            label: "Due today",
            icon: Calendar,
            color: "#F59E0B",
            count: dueTodayTasks.length,
            tasks: sortTasksByPriorityAndDate(dueTodayTasks),
          },
          // Due tomorrow section
          {
            id: "dueTomorrow",
            label: "Due tomorrow",
            icon: Tomorrow,
            color: "#3B82F6",
            count: dueTomorrowTasks.length,
            tasks: sortTasksByPriorityAndDate(dueTomorrowTasks),
          },
          // Due soon section
          {
            id: "dueSoon",
            label: "Due soon",
            icon: Soon,
            color: "#8B5CF6",
            count: dueSoonTasks.length,
            tasks: sortTasksByPriorityAndDate(dueSoonTasks),
          },
          // Inbox section - all tasks without tags, regardless of schedule date
          {
            id: "inbox",
            label: "Inbox",
            icon: InboxAlt,
            color: "#6B7280",
            count: displayableTasks.filter((task) => !task.tag || !task.tag.id).length,
            tasks: sortTasksByPriorityAndDate(displayableTasks.filter((task) => !task.tag || !task.tag.id)),
          },
          // Add all tags as sections
          ...tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            icon: Tag,
            color: tag.color,
            count: displayableTasks.filter(
              (task) => task.tag && task.tag.id === tag.id
            ).length,
            tasks: sortTasksByPriorityAndDate(displayableTasks.filter(
              (task) => task.tag && task.tag.id === tag.id
            )),
          })),
        ]
      : [];

  // Auto-collapse sections when they become empty
  useEffect(() => {
    const sectionsToCollapse = [];
    
    // Check each expanded section to see if it's now empty
    Object.keys(expandedSections).forEach(sectionId => {
      if (expandedSections[sectionId]) {
        // Find the section data
        const sectionData = [
          { id: "overdue", count: overdueTasks.length },
          { id: "dueToday", count: dueTodayTasks.length },
          { id: "dueTomorrow", count: dueTomorrowTasks.length },
          { id: "dueSoon", count: dueSoonTasks.length },
          { id: "inbox", count: displayableTasks.filter((task) => !task.tag || !task.tag.id).length },
          ...tags.map(tag => ({
            id: tag.id,
            count: displayableTasks.filter((task) => task.tag && task.tag.id === tag.id).length
          }))
        ].find(section => section.id === sectionId);
        
        // If section exists and is empty, mark it for collapse
        if (sectionData && sectionData.count === 0) {
          sectionsToCollapse.push(sectionId);
        }
      }
    });
    
    // Collapse empty sections
    if (sectionsToCollapse.length > 0) {
      setExpandedSections(prev => {
        const updated = { ...prev };
        sectionsToCollapse.forEach(sectionId => {
          updated[sectionId] = false;
        });
        return updated;
      });
    }
  }, [expandedSections, overdueTasks.length, dueTodayTasks.length, dueTomorrowTasks.length, dueSoonTasks.length, displayableTasks, tags]);

  // Update expandedSections when tags change
  useEffect(() => {
    setExpandedSections((prev) => {
      const updated = { ...prev };
      // Ensure all tags have an expansion state
      tags.forEach((tag) => {
        if (!(tag.id in updated)) {
          updated[tag.id] = true; // New tags start expanded
        }
      });
      return updated;
    });
  }, [tags]);

  const handleAddTag = (newTag) => {
    setTags((prevTags) => {
      const updatedTags = [...prevTags, newTag];
      localStorage.setItem("tags", JSON.stringify(updatedTags));
      return updatedTags;
    });

    // Ensure the new tag's section is expanded
    setExpandedSections((prev) => ({
      ...prev,
      [newTag.id]: true,
    }));
  };

  // Function to check and remove completed tasks older than 24 hours
  const removeExpiredCompletedTasks = useCallback(() => {
    const now = new Date();
    
    setTasks(prev => {
      if (!prev.completed || !Array.isArray(prev.completed)) return prev;
      
      // Filter out completed tasks older than 24 hours
      const filteredCompletedTasks = prev.completed.filter(task => {
        if (!task.completedAt) return true; // Keep tasks without completedAt timestamp
        
        const completedAt = new Date(task.completedAt);
        const hoursDiff = (now - completedAt) / (1000 * 60 * 60); // Convert ms to hours
        
        return hoursDiff < 24; // Keep tasks completed less than 24 hours ago
      });
      
      // If no tasks were removed, return the original state
      if (filteredCompletedTasks.length === prev.completed.length) return prev;
      
      // Update the tasks state with filtered completed tasks
      const newTasks = {
        ...prev,
        completed: filteredCompletedTasks
      };
      
      // Save to localStorage
      localStorage.setItem("tasks", JSON.stringify(newTasks));
      return newTasks;
    });
  }, []);
  
  // Check for expired completed tasks when the component mounts
  useEffect(() => {
    removeExpiredCompletedTasks();
  }, [removeExpiredCompletedTasks]);

  const getTasksForView = () => {
    if (selectedView === "all") {
      // For the All view, filter tasks by the current section
      if (selectedTag) {
        // Get tasks for the current tag group
        return allTasksArray.filter(
          (task) => task.tag && task.tag.id === selectedTag.id
        );
      } else {
        return allTasksArray;
      }
    } else if (selectedView === "completed") {
      // Get all completed tasks
      return tasks.completed || [];
    } else {
      return [];
    }
  };

  return (
    // eslint-disable-next-line tailwindcss/no-custom-classname
    <aside className="w-[240px] min-w-[240px] h-full bg-light-bg-light dark:bg-dark-bg overflow-y-auto relative flex flex-col">
      <div className="h-full flex flex-col">
        
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence initial={false} mode="sync">
            {activeTab === "tasks" ? (
              <motion.div
                key="tasks"
                className="absolute inset-0 flex flex-col"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{
                  type: "easeInOut",
                  duration: 0.2,
                  ease: [0.25, 1, 0.5, 1],
                }}
              >
                <div className="flex rounded-[7px] ml-3 p-0.5 bg-black/5 dark:bg-dark-bg-lighter gap-2">
                  {/* "All" Button */}
                  <button
                    className={`group relative flex-grow basis-0 flex items-center justify-center cursor-pointer text-xs h-[24px] rounded-[5px] transition-colors duration-150 ease-in-out
                                ${
                                  selectedView === "all"
                                    ? "font-medium text-light-text dark:text-dark-text"
                                    : "text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
                                }`}
                    onClick={() => setSelectedView("all")}
                  >
                    <span className="relative z-10">All</span>
                    {selectedView === "all" && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 rounded-[5px] shadow-sm 
                                   bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% 
                                   dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] 
                                   outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border"
                        transition={{ type: "spring", stiffness: 600, damping: 40 }}
                      />
                    )}
                  </button>

                  {/* "Completed" Button */}
                  <button
                    className={`group relative flex-grow basis-0 flex items-center justify-center cursor-pointer text-xs h-[24px] rounded-[5px] transition-colors duration-150 ease-in-out
                                ${
                                  selectedView === "completed"
                                    ? "font-medium text-light-text dark:text-dark-text"
                                    : "text-light-text/50 dark:text-dark-text/50 hover:text-light-text dark:hover:text-dark-text rounded-[5px]"
                                }`}
                    onClick={() => setSelectedView("completed")}
                  >
                    <span className="relative z-10">Completed</span>
                    {selectedView === "completed" && (
                      <motion.div
                        layoutId="activeTabIndicator" // Same layoutId
                        className="absolute inset-0 rounded-[5px] shadow-sm 
                                   bg-gradient-to-b from-light-bg from-70% to-light-bg-light to-100% 
                                   dark:bg-gradient-to-b dark:from-white/[0.035] dark:to-white/[0.05] 
                                   outline outline-1 outline-offset-[-1px] outline-light-border dark:outline-dark-border"
                        transition={{ type: "spring", stiffness: 600, damping: 40 }}
                      />
                    )}
                  </button>
                </div>
                
                {/* Today's Tasks Progress Widget */}
                {showTodaysTasks && (
                  <TodaysTasksProgress 
                    tasks={tasks} 
                    onAddTask={(schedule) => {
                      if (commandBarRef?.current && schedule === 'today') {
                        commandBarRef.current.openForNewTask(new Date());
                        // Set scheduled date to today
                        setTimeout(() => {
                          const today = new Date();
                          commandBarRef.current.setScheduledDate?.(today);
                        }, 50);
                      }
                    }}
                  />
                )}
                
                <nav className="flex-1 overflow-auto pt-2 dark:bg-dark-bg">
                  <div className="space-y-1 flex flex-col">
                    {selectedView === "all" ? (
                      <>
                        {sections.map((section, index) => (
                          <div key={section.id}>
                            <div className="overflow-hidden flex-col gap-2 ml-3">
                          <div
                            role="button"
                            onClick={() => {
                              // Only allow toggling if the section has tasks
                              if (section.count > 0) {
                                setExpandedSections((prev) => ({
                                  ...prev,
                                  [section.id]: !prev[section.id],
                                }))
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (![
                                "overdue",
                                "dueToday", 
                                "dueTomorrow",
                                "dueSoon",
                                "inbox"
                              ].includes(section.id)) {
                                setColorMenuPosition({
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                                setSelectedTagId(section.id);
                                setColorMenuOpen(true);
                              }
                            }}
                            style={{
                              backgroundColor: "transparent",
                            }}
                            className={`group w-full font-medium flex items-center gap-2 py-3 ${
                              expandedSections[section.id]
                                ? "bg-light-selected dark:bg-dark-selected"
                                : ""
                            }`}
                          >
                            <div className="w-3 h-3 flex items-center justify-center">
                              <Chevron
                                className={`w-4 h-4 text-light-text/50 dark:text-dark-text/50 transition-transform ${
                                  expandedSections[section.id]
                                    ? "rotate-90"
                                    : ""
                                }`}
                              />
                            </div>
                            {![
                              "overdue",
                              "dueToday", 
                              "dueTomorrow",
                              "dueSoon",
                              "inbox"
                            ].includes(section.id) ? (
                              <div className="w-3 h-3 items-center">
                                <div
                                  className="w-[12px] h-[12px] rounded-[5px] "
                                  style={{
                                    backgroundColor: section.color + "B3",
                                    border: `2px solid ${section.color}`,
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="w-4 h-4 flex items-center justify-center">
                                <section.icon className="w-4 h-4" style={{ color: section.color }} />
                              </div>
                            )}
                            {editingTagId === section.id ? (
                              <input
                                type="text"
                                value={editingTagName}
                                onChange={(e) => setEditingTagName(e.target.value)}
                                onBlur={() => {
                                  if (editingTagName.trim()) {
                                    const updatedTags = tags.map((t) =>
                                       t.id === section.id ? { ...t, label: editingTagName.trim() } : t
                                     );
                                     setTags(updatedTags);
                                     
                                     // Dispatch tags-updated event to notify other components
                                     window.dispatchEvent(new CustomEvent('tags-updated', {
                                       detail: updatedTags
                                     }));
                                     
                                     // Update all tasks that use this tag
                                     setTasks((prevTasks) => {
                                       const updatedTasksState = { ...prevTasks };
                                       Object.keys(updatedTasksState).forEach((group) => {
                                         if (Array.isArray(updatedTasksState[group])) {
                                           updatedTasksState[group] = updatedTasksState[group].map((task) =>
                                             task.tag?.id === section.id
                                               ? {
                                                   ...task,
                                                   tag: {
                                                     ...task.tag,
                                                     label: editingTagName.trim(),
                                                   },
                                                 }
                                               : task
                                           );
                                         }
                                       });
                                       
                                       // Dispatch tasks-updated event to notify other components
                                       window.dispatchEvent(new CustomEvent('tasks-updated', {
                                         detail: updatedTasksState
                                       }));
                                       
                                       return updatedTasksState;
                                     });
                                  }
                                  setEditingTagId(null);
                                  setEditingTagName("");
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.target.blur();
                                  } else if (e.key === 'Escape') {
                                    setEditingTagId(null);
                                    setEditingTagName("");
                                  }
                                }}
                                className="bg-transparent border-none outline-none text-sm text-light-text dark:text-dark-text min-w-0 flex-1"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span 
                                className="flex items-end justify-center select-none text-left text-sm cursor-pointer"
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  // Only allow renaming for custom tags (not built-in sections)
                                  if (![
                                    "overdue",
                                    "dueToday", 
                                    "dueTomorrow",
                                    "dueSoon",
                                    "inbox"
                                  ].includes(section.id)) {
                                    setEditingTagId(section.id);
                                    setEditingTagName(section.label);
                                  }
                                }}
                              >
                                {section.label}
                              </span>
                            )}
                            {section.count > 0 && (
                              <span className="text-[10px] py-0.5 font-medium text-light-text/50 dark:text-dark-text/50">
                                {section.count}
                              </span>
                            )}
                            {/* Add icon for all sections except overdue and dueSoon */}
                            {!["overdue", "dueSoon"].includes(section.id) && (
                              <div className="flex justify-end items-center gap-1 ml-auto">
                                {/* Add icon - visible on hover */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    
                                    if (commandBarRef?.current) {
                                      // Reset task state first
                                      // Open with no date for inbox, current date for others
                                      const initialDate = section.id === "inbox" ? null : new Date();
                                      commandBarRef.current.openForNewTask(initialDate);
                                      
                                      // Set pre-filled values based on section
                                      setTimeout(() => {
                                        if (section.id === "dueToday") {
                                          // Set scheduled date to today
                                          const today = new Date();
                                          commandBarRef.current.setScheduledDate?.(today);
                                        } else if (section.id === "dueTomorrow") {
                                          // Set scheduled date to tomorrow
                                          const tomorrow = new Date();
                                          tomorrow.setDate(tomorrow.getDate() + 1);
                                          commandBarRef.current.setScheduledDate?.(tomorrow);
                                        } else if (section.id === "inbox") {
                                          // No pre-filled values for inbox
                                        } else {
                                          // For user-defined tag groups, set the tag
                                          const tag = tags.find(t => t.id === section.id);
                                          if (tag) {
                                            commandBarRef.current.setSelectedTag?.(tag);
                                          }
                                        }
                                      }, 50);
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 flex px-1 py-1 rounded-[5px] items-center hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter"
                                >
                                  <Add className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                                </button>
                                
                                {/* More icon for user-defined tag groups only */}
                                {!["overdue", "dueToday", "dueTomorrow", "dueSoon", "inbox"].includes(section.id) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setColorMenuPosition({
                                        x: e.clientX,
                                        y: e.clientY,
                                      });
                                      setSelectedTagId(section.id);
                                      setColorMenuOpen(true);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 flex px-1 py-1 rounded-[5px] items-center hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter"
                                  >
                                    <More className="w-4 h-4 text-light-text/50 dark:text-dark-text/50" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <AnimatePresence initial={false}>
                            {expandedSections[section.id] && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                transition={{
                                  duration: 0.2,
                                  ease: [0.4, 0, 0.2, 1],
                                }}
                                className=""
                              >
                                <div className="flex flex-col gap-1">
                                  <div className="mt-1 flex flex-col gap-1">
                                    {section.tasks.map((task) => (
                                      <TaskItem
                                        key={task.id}
                                        task={{
                                          ...task,
                                          tag: task.tag || null,
                                        }}
                                        onComplete={handleToggleTaskCompletion}
                                        onDelete={handleDeleteTask}
                                        onEdit={handleEditTaskIconClick}
                                        onDoubleClickEdit={handleEditTaskIconClick}
                                        onClick={() =>
                                          setSelectedTaskId(task.id)
                                        }
                                        isSelected={
                                          selectedTaskId === task.id || commandBarSelectedTasks.has(task.id)
                                        }
                                        onSelect={(taskId, e, isSelected) => {
                                            // Clear local selection when using multi-select
                                            setSelectedTaskId(null);
                                            if (commandBarRef?.current?.selectTask) {
                                              commandBarRef.current.selectTask(taskId, e, isSelected);
                                            }
                                          }}
                                        hideTag={["overdue", "dueToday", "dueTomorrow", "dueSoon", "inbox"].includes(section.id) ? false : true}
                                        isRecurring={task.isRepeat || (task.repeat && task.repeat !== 'none')}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                            </div>
                            {/* Add divider after inbox section to separate pre-determined sections from user-created tag groups */}
                            {section.id === "inbox" && (
                              <div className="ml-3 my-3">
                                <div className="h-px bg-light-border dark:bg-dark-border"></div>
                              </div>
                            )}
                          </div>
                        ))}
                      </>
                    ) : (
                      // Today, Upcoming, and Completed views
                      <div className="flex flex-col pl-3 gap-1 mt-2">
                        {(() => {
                          const tasks = getTasksForView();
                          if (selectedView === "completed") {
                            return tasks.length > 0 ? (
                              tasks.map((task) => (
                                <TaskItem
                                  key={task.id}
                                  task={{
                                    ...task,
                                    tag: task.tag || null,
                                  }}
                                  onComplete={handleToggleTaskCompletion}
                                  onDelete={handleDeleteTask}
                                  onEdit={handleEditTaskIconClick}
                                  onDoubleClickEdit={handleEditTaskIconClick}
                                  onClick={() => setSelectedTaskId(task.id)}
                                  isSelected={selectedTaskId === task.id || commandBarSelectedTasks.has(task.id)}
                                  onSelect={(taskId, e, isSelected) => {
                                  // Clear local selection when using multi-select
                                  setSelectedTaskId(null);
                                  if (commandBarRef?.current?.selectTask) {
                                    commandBarRef.current.selectTask(taskId, e, isSelected);
                                  }
                                }}
                                  hideTag={false}
                                  checked={true}
                                  isRecurring={task.isRepeat || (task.repeat && task.repeat !== 'none')} // Force checked state for completed tasks
                                />
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center px-4 rounded-[9px] py-6 text-center">
                                <div className="text-light-text/50 dark:text-dark-text/50 mb-3">
                                  <Completed className="w-6 h-6" />
                                </div>
                                <p className="text-xs font-medium text-light-text/50 dark:text-dark-text/50">
                                  No completed tasks yet
                                </p>
                                <p className="text-xs text-light-text/50 dark:text-dark-text/50 mt-1 leading-relaxed">
                                  Completed tasks will appear here for 24 hours
                                </p>
                              </div>
                            );
                          } else {
                            // Default view for regular tasks (not completed)
                            return tasks.length > 0 ? (
                              tasks.map((task) => (
                                <TaskItem
                                  key={task.id}
                                  task={{
                                    ...task,
                                    tag: task.tag || null,
                                  }}
                                  onComplete={handleToggleTaskCompletion}
                                  onDelete={handleDeleteTask}
                                  onEdit={handleEditTaskIconClick}
                                  onDoubleClickEdit={handleEditTaskIconClick}
                                  onClick={() => setSelectedTaskId(task.id)}
                                  isSelected={selectedTaskId === task.id || commandBarSelectedTasks.has(task.id)}
                                  onSelect={(taskId, e, isSelected) => {
                                    // Clear local selection when using multi-select
                                    setSelectedTaskId(null);
                                    if (commandBarRef?.current?.selectTask) {
                                      commandBarRef.current.selectTask(taskId, e, isSelected);
                                    }
                                  }}
                                  hideTag={false}
                                />
                              ))
                            ) : (
                              <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="text-light-text/40 dark:text-dark-text/40 mb-2">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9"></path>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                                  </svg>
                                </div>
                                <p className="text-sm text-light-text/60 dark:text-dark-text/60">
                                  No tasks yet
                                </p>
                                <p className="text-xs text-light-text/40 dark:text-dark-text/40 mt-1">
                                  Create a task to get started
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </nav>
              </motion.div>
            ) : (
              <motion.div
                key="agenda"
                className="absolute inset-0 flex flex-col"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{
                  type: "easeInOut",
                  duration: 0.2,
                  ease: [0.25, 1, 0.5, 1],
                }}
              >
                <div className="flex-1 overflow-y-auto">
                  <AgendaView
                    events={events}
                    tasks={allTasksArray}
                    selectedDate={selectedDate}
                    onDateSelect={(date) => {
                      // AgendaView date selected
                      // Ensure we're passing a fresh date object to prevent reference issues
                      onDateSelect(new Date(date));
                    }}
                    onTaskComplete={handleToggleTaskCompletion}
                    onTaskDelete={handleDeleteTask}
                    onTaskEdit={handleEditTaskIconClick}
                    commandBarRef={commandBarRef}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Color Picker Menu */}
        {colorMenuOpen && (
          <div className="fixed top-0 left-0 z-50 pointer-events-none" style={{ transform: `translate(${colorMenuPosition.x}px, ${colorMenuPosition.y}px)` }}>
            <Popover open={true} onOpenChange={(open) => !open && setColorMenuOpen(false)}>
              <PopoverTrigger asChild>
                <div className="w-0 h-0" />
              </PopoverTrigger>
              <PopoverContent
                className="p-0 bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md outline outline-1 outline-dark-border dark:outline-dark-border"
                align="start"
                side="right"
                sideOffset={5}
                avoidCollisions={true}
                style={{ width: 'auto' }}
              >
                <div className="pointer-events-auto">
                  <div className="flex flex-wrap gap-2 pb-1 p-3" style={{ maxWidth: '280px' }}>
                    {TAG_COLORS.map((color) => {
                      const selectedTag = tags.find(t => t.id === selectedTagId);
                      const isSelected = selectedTag && selectedTag.color === color;
                      return (
                        <motion.div
                          key={color}
                          className={`relative w-5 h-5 rounded-md cursor-pointer flex items-center justify-center`}
                          style={{ backgroundColor: color }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            const updatedTags = tags.map((t) =>
                              t.id === selectedTagId ? { ...t, color: color } : t
                            );
                            setTags(updatedTags);

                            // Dispatch tags-updated event to notify other components
                            window.dispatchEvent(new CustomEvent('tags-updated', {
                              detail: updatedTags
                            }));

                            // Update all tasks that use this tag
                            setTasks((prevTasks) => {
                              const updatedTasksState = { ...prevTasks };
                              Object.keys(updatedTasksState).forEach((group) => {
                                if (Array.isArray(updatedTasksState[group])) {
                                  updatedTasksState[group] = updatedTasksState[group].map((task) =>
                                    task.tag?.id === selectedTagId
                                      ? {
                                          ...task,
                                          tag: {
                                            ...task.tag,
                                            color: color,
                                          },
                                        }
                                      : task
                                  );
                                }
                              });
                              
                              // Dispatch tasks-updated event to notify other components
                              window.dispatchEvent(new CustomEvent('tasks-updated', {
                                detail: updatedTasksState
                              }));
                              
                              return updatedTasksState;
                            });

                            setColorMenuOpen(false);
                          }}
                        >
                          {isSelected && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                  <div className="pt-1">
                    {selectedTagId && (
                      <>
                        <div className="border-t border-light-border-2 dark:border-dark-border mt-2" />
                        <div className="p-1 space-y-1">
                          <button
                            className="w-full group flex items-center gap-2 text-left px-2 py-2 rounded-[5px] font-medium text-xs text-light-text dark:text-dark-text hover:bg-white/15 dark:hover:bg-white/10"
                            onClick={() => {
                              const tagToRename = tags.find(t => t.id === selectedTagId);
                              if (tagToRename) {
                                setEditingTagId(selectedTagId);
                                setEditingTagName(tagToRename.label);
                              }
                              setColorMenuOpen(false);
                            }}
                          >
                            <Edit className="w-3 h-3 text-white/50 group-hover:text-white" />
                            <span className="text-white"> Rename </span>
                          </button>
                          <button
                            className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-[5px] font-medium text-xs text-red-500 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                            onClick={() => {
                              const updatedTags = tags.filter((tag) => tag.id !== selectedTagId);
                              setTags(updatedTags);
                              
                              // Dispatch tags-updated event to notify other components
                              window.dispatchEvent(new CustomEvent('tags-updated', {
                                detail: updatedTags
                              }));
                              setColorMenuOpen(false);
                            }}
                          >
                            <Trash className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        )}
        {/* Tab selector */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 border border-light-border dark:border-dark-border flex items-center gap-1 bg-light-bg dark:bg-dark-bg-lighter rounded-[9px] p-1 shadow-lg">
          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`py-2 px-3 rounded-[5px] transition-colors duration-200 ${
                    activeTab === "tasks"
                      ? "bg-light-bg-lighter dark:bg-dark-bg"
                      : "hover:bg-light-bg-light dark:hover:bg-dark-bg-lighter"
                  }`}
                >
                  <Completed
                    className={`w-5 h-5 ${
                      activeTab === "tasks"
                        ? "text-light-text dark:text-dark-text"
                        : "text-light-text/50 dark:text-dark-text/50"
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center" sideOffset={10}>Tasks</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("agenda")}
                  className={`py-2 px-3 rounded-[5px] transition-colors duration-200 ${
                    activeTab === "agenda"
                      ? "bg-light-bg-lighter dark:bg-dark-bg"
                      : "hover:bg-light-bg-light dark:hover:bg-dark-bg-lighter"
                  }`}
                >
                  <InboxIcon
                    className={`w-5 h-5 ${
                      activeTab === "agenda"
                        ? "text-light-text dark:text-dark-text"
                        : "text-light-text/50 dark:text-dark-text/50"
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="center" sideOffset={10}>Agenda</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      
      {/* RepeatTaskEditModal */}
      <RepeatTaskEditModal
        isOpen={isRepeatTaskEditModalOpen}
        task={taskToEdit}
        taskTitle={taskToEdit?.title}
        onClose={() => {
          setIsRepeatTaskEditModalOpen(false);
          setTaskToEdit(null);
          setDraggedTask(null);
        }}
        onEditConfirm={({ scope, task }) => {
          // Handle the edit confirmation based on scope
          if (scope === 'single') {
            // For single instance edits, prepare the task for detachment but don't process yet
            // The detachment will happen when the user saves changes in CommandBar
            const taskForEdit = {
              ...task,
              _detachedTask: true,
              _editScope: 'single',
              _originalTask: taskToEdit // Keep reference to original for detachment logic
            };
            
            // Open CommandBar for editing - detachment will occur on save
            setEditingTaskId(taskToEdit.id);
            setOriginalTask(taskToEdit);
            commandBarRef.current.openForTaskEdit(taskForEdit);
          } else {
            // Edit the series (future or all) - pass the task with scope information
            const taskForEdit = {
              ...taskToEdit,
              _editScope: scope,
              _updateSeries: scope === 'all',
              _originalTask: taskToEdit
            };
            
            setEditingTaskId(taskToEdit.id);
            setOriginalTask(taskToEdit);
            commandBarRef.current.openForTaskEdit(taskForEdit);
          }
          
          // Close the modal
          setIsRepeatTaskEditModalOpen(false);
          setTaskToEdit(null);
          setDraggedTask(null);
        }}
        originalTask={taskToEdit}
        draggedTask={draggedTask}
        isEditOperation={true}
        commandBarRef={commandBarRef}
      />
    </aside>
  );
}
