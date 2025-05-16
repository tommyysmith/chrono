"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { format, isToday, isTomorrow } from "date-fns";
import { useTaskManagement } from "../hooks/useTaskManagement";
import { Completed } from "../assets/icons/Completed";
import { Check } from "../assets/icons/Check"; 
// import ThemeToggle from '../components/ThemeToggle';
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Inbox,
  Circle,
  List,
  Plus,
  ListTodo,
  Briefcase,
  Heart,
  User,
  Plane,
  CalendarDays,
  CalendarClock,
  LayoutGrid,
  X,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import TagDropdown from "./TagDropdown";
import TaskItem from "./TaskItem";
import Checkbox from "./Checkbox";
import { TAG_COLORS } from "../constants/colors";
import { Chevron } from "../assets/icons/Chevron";
import { Calendar } from "../assets/icons/Calendar";
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

export default function Sidebar({
  commandBarRef,
  events = [],
  selectedDate,
  onDateSelect,
  setIsVisible,
}) {
  // Get task management functions
  const { getTasksInSeries, getRecurringTaskInstances } = useTaskManagement();
  const [activeTab, setActiveTab] = useState(() => {
    // Try to load from localStorage first
    const savedTab = localStorage.getItem("activeTab");
    if (savedTab) {
      try {
        return savedTab;
      } catch (e) {
        console.error("Error parsing activeTab:", e);
      }
    }

    // Default to 'tasks' if no saved state
    return "tasks";
  }); // 'tasks' or 'agenda'

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("activeTab", activeTab);
  }, [activeTab]);

  const [expandedSections, setExpandedSections] = useState(() => {
    // Try to load from localStorage first
    const savedState = localStorage.getItem("expandedSections");
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error("Error parsing expandedSections:", e);
      }
    }

    // Initialize with default sections expanded if no saved state
    return {
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
    localStorage.setItem("expandedSections", JSON.stringify(expandedSections));
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

    // Try to load from localStorage
    const savedTags = localStorage.getItem("tags");
    if (savedTags) {
      try {
        return JSON.parse(savedTags);
      } catch (e) {
        console.error("Error parsing tags:", e);
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

    // Try to load from localStorage
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
        return {
          ...initialTasks,
          ...parsed,
        };
      } catch (e) {
        console.error("Error parsing tasks:", e);
      }
    }
    return initialTasks;
  });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [originalTask, setOriginalTask] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  }, [tasks]);

  // Save tags to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("tags", JSON.stringify(tags));
  }, [tags]);

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

  // Listen for tasks-updated event from CommandBar
  useEffect(() => {
    const handleTasksUpdated = (event) => {
      // Update tasks state when event is received
      setTasks(event.detail);
    };

    // Add event listener
    window.addEventListener("tasks-updated", handleTasksUpdated);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener("tasks-updated", handleTasksUpdated);
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

  const handleAddTask = (e) => {
    if (e.key === "Enter" && taskTitle.trim()) {
      const newTask = {
        id: Date.now(),
        title: taskTitle.trim(),
        completed: false,
        tag: selectedTag || null,
      };

      setTasks((prevTasks) => {
        const updatedTasks = {
          ...prevTasks,
          all: [...(prevTasks.all || []), newTask],
        };

        // Add to tag collection if tag is selected
        if (selectedTag) {
          updatedTasks[selectedTag.id] = [
            ...(prevTasks[selectedTag.id] || []),
            newTask,
          ];
        }

        // Add to today if in today view
        if (selectedView === "today") {
          updatedTasks.today = [...(prevTasks.today || []), newTask];
        }

        return updatedTasks;
      });

      if (pendingTag) {
        const newTag = pendingTag;
        setTags((prevTags) => {
          const updatedTags = [...prevTags, newTag];
          // Update expandedSections for the new tag
          setExpandedSections((prev) => ({
            ...prev,
            [newTag.id]: true,
          }));
          return updatedTags;
        });
        setPendingTag(null);
      }

      setTaskTitle("");
      setSelectedTag(null);
      setIsAddingTask(false);
    }
  };

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    if (isAddingTask) {
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isAddingTask]);

  useEffect(() => {
    if (isAddingTask && taskInputRef.current) {
      taskInputRef.current.focus();
    }
  }, [isAddingTask]);

  const handleDeleteTask = (taskId) => {
    setTasks((prev) => {
      const newTasks = { ...prev };
      // Remove from all collections
      Object.keys(newTasks).forEach((group) => {
        if (Array.isArray(newTasks[group])) {
          newTasks[group] = newTasks[group].filter(
            (task) => task.id !== taskId
          );
        }
      });
      // Save to localStorage immediately
      localStorage.setItem("tasks", JSON.stringify(newTasks));
      return newTasks;
    });
  };

  const handleCompleteTask = (taskId) => {
    setTasks((prev) => {
      const newTasks = { ...prev };
      
      // Find the task in any collection
      let taskToUpdate = null;
      Object.keys(newTasks).forEach((group) => {
        if (Array.isArray(newTasks[group])) {
          const foundTask = newTasks[group].find(task => task.id === taskId);
          if (foundTask) {
            taskToUpdate = foundTask;
          }
        }
      });
      
      if (!taskToUpdate) return prev; // Task not found
      
      const newCompletedState = !taskToUpdate.completed;
      
      if (newCompletedState) {
        // Task is being marked as completed
        // Add completedAt timestamp
        const completedTask = {
          ...taskToUpdate,
          completed: true,
          completedAt: new Date().toISOString()
        };
        
        // Add to completed collection
        newTasks.completed = [...(newTasks.completed || []), completedTask];
        
        // Remove from all other collections except 'completed'
        Object.keys(newTasks).forEach((group) => {
          if (group !== 'completed' && Array.isArray(newTasks[group])) {
            newTasks[group] = newTasks[group].filter(task => task.id !== taskId);
          }
        });
      } else {
        // Task is being unmarked as completed
        // Remove from completed collection
        if (Array.isArray(newTasks.completed)) {
          newTasks.completed = newTasks.completed.filter(task => task.id !== taskId);
        }
        
        // Add back to all collection and its tag collection if it has one
        const updatedTask = { ...taskToUpdate, completed: false };
        delete updatedTask.completedAt; // Remove completedAt timestamp
        
        newTasks.all = [...(newTasks.all || []), updatedTask];
        
        // Add to tag collection if it has a tag
        if (updatedTask.tag) {
          const tagId = updatedTask.tag.id;
          newTasks[tagId] = [...(newTasks[tagId] || []), updatedTask];
        }
        
        // Add to today collection if scheduled for today
        if (updatedTask.scheduledDate && isToday(new Date(updatedTask.scheduledDate))) {
          newTasks.today = [...(newTasks.today || []), updatedTask];
        }
      }
      
      // Save to localStorage immediately
      localStorage.setItem("tasks", JSON.stringify(newTasks));
      return newTasks;
    });
  };

  // Add an effect to ensure tasks and tags stay in sync with localStorage
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "tasks") {
        try {
          const newTasks = JSON.parse(e.newValue);
          setTasks(newTasks);
        } catch (e) {
          console.error("Error parsing tasks from storage event:", e);
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
          console.error("Error parsing tags from storage event:", e);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const handleEditTask = (task) => {
    if (commandBarRef?.current) {
      setEditingTaskId(task.id);
      setOriginalTask(task);
      commandBarRef.current.openForTaskEdit(task);
    }
  };

  // Get all unique tasks with their complete data
  const allTasks = Object.values(tasks)
    .filter(Array.isArray) // Filter out any non-array values
    .reduce((unique, group) => {
      group.forEach((task) => {
        // Skip recurring task instances (only show the base task)
        if (task.isRepeat) return;
        
        // Skip completed tasks (they should only appear in the completed tab)
        if (task.completed) return;
        
        // Use task.id as the key to ensure uniqueness
        unique[task.id] = task;
      });
      return unique;
    }, {});

  const allTasksArray = Object.values(allTasks);

  // Generate sections including all tags
  const sections =
    selectedView === "all"
      ? [
          {
            id: "all",
            label: "All tasks",
            icon: LayoutGrid,
            color: "#22C55E",
            count: allTasksArray.length,
            subsections: [
              {
                id: "scheduled",
                label: "Scheduled",
                tasks: allTasksArray
                  .filter((task) => task.scheduledDate)
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledDate) - new Date(b.scheduledDate)
                  ),
              },
              {
                id: "anytime",
                label: "Anytime",
                tasks: allTasksArray.filter((task) => !task.scheduledDate),
              },
            ],
          },
          // Add all tags as sections
          ...tags.map((tag) => ({
            id: tag.id,
            label: tag.label,
            icon: Tag,
            color: tag.color,
            count: allTasksArray.filter(
              (task) => task.tag && task.tag.id === tag.id
            ).length,
            tasks: allTasksArray.filter(
              (task) => task.tag && task.tag.id === tag.id
            ),
          })),
        ]
      : [];

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
                <div className="flex rounded-[9px] ml-3 p-1 bg-black/5 dark:bg-black/30 gap-2">
                  {/* "All" Button */}
                  <button
                    className={`group relative flex-grow basis-0 flex items-center justify-center cursor-pointer text-xs h-[28px] rounded-[5px] transition-colors duration-150 ease-in-out
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
                    className={`group relative flex-grow basis-0 flex items-center justify-center cursor-pointer text-xs h-[28px] rounded-[5px] transition-colors duration-150 ease-in-out
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
                <nav className="flex-1 overflow-auto pt-2 dark:bg-dark-bg">
                  <div className="space-y-1 flex flex-col gap-2">
                    {selectedView === "all" ? (
                      sections.map((section) => (
                        <div
                          key={section.id}
                          className="overflow-hidden flex-col gap-2 border-b border-light-border dark:border-dark-border last:border-none pb-2 mr-3 ml-3"
                        >
                          <div
                            role="button"
                            onClick={() =>
                              setExpandedSections((prev) => ({
                                ...prev,
                                [section.id]: !prev[section.id],
                              }))
                            }
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (section.id !== "all") {
                                setColorMenuPosition({
                                  x: e.clientX,
                                  y: e.clientY,
                                });
                                setSelectedTagId(section.id);
                                setColorMenuOpen(true);
                              }
                            }}
                            style={{
                              backgroundColor:
                                section.id !== "all" ? `` : "transparent",
                            }}
                            className={`w-full font-medium flex items-center gap-2 py-2 ${
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
                            {section.id !== "all" && (
                              <div className="w-3 h-3 items-center">
                                <div
                                  className="w-[12px] h-[12px] rounded-[5px] "
                                  style={{
                                    backgroundColor: section.color + "B3",
                                    border: `2px solid ${section.color}`,
                                  }}
                                />
                              </div>
                            )}
                            <span className="flex items-end justify-center text-left text-sm">
                              {section.label}
                            </span>
                            {section.count > 0 && (
                              <span className="text-[10px] py-0.5 font-medium text-light-text/50 dark:text-dark-text/50">
                                {section.count}
                              </span>
                            )}
                            {section.id !== "all" && (
                              <div className="flex w-full justify-end">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent the click from reaching the parent button
                                    if (section.id !== "all") {
                                      setColorMenuPosition({
                                        x: e.clientX,
                                        y: e.clientY,
                                      });
                                      setSelectedTagId(section.id);
                                      setColorMenuOpen(true);
                                    }
                                  }}
                                  className="flex group px-1 py-1 rounded-[5px] items-center hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter"
                                >
                                  <More className="w-4 h-4 text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text" />
                                </button>
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
                                <div className="flex flex-col gap-2 py-1">
                                  <div className="mt-1 flex flex-col gap-1">
                                    {section.id === "all"
                                      ? // Render subsections for All Tasks
                                        section.subsections.map(
                                          (subsection) => (
                                            <div
                                              key={subsection.id}
                                              className="flex flex-col gap-1"
                                            >
                                              <div className="px-2 py-1 text-xs font-medium text-light-text/50 dark:text-dark-text/50">
                                                {subsection.label} (
                                                {subsection.tasks.length})
                                              </div>
                                              {subsection.tasks.map((task) => (
                                                <TaskItem
                                                  key={task.id}
                                                  task={{
                                                    ...task,
                                                    tag: task.tag || null,
                                                  }}
                                                  onComplete={
                                                    handleCompleteTask
                                                  }
                                                  onDelete={handleDeleteTask}
                                                  onEdit={handleEditTask}
                                                  onDoubleClickEdit={
                                                    handleEditTask
                                                  }
                                                  onClick={() =>
                                                    setSelectedTaskId(task.id)
                                                  }
                                                  isSelected={
                                                    selectedTaskId === task.id
                                                  }
                                                  hideTag={false}
                                                />
                                              ))}
                                            </div>
                                          )
                                        )
                                      : // Render tasks for tag groups
                                        section.tasks.map((task) => (
                                          <TaskItem
                                            key={task.id}
                                            task={{
                                              ...task,
                                              tag: task.tag || null,
                                            }}
                                            onComplete={handleCompleteTask}
                                            onDelete={handleDeleteTask}
                                            onEdit={handleEditTask}
                                            onDoubleClickEdit={handleEditTask}
                                            onClick={() =>
                                              setSelectedTaskId(task.id)
                                            }
                                            isSelected={
                                              selectedTaskId === task.id
                                            }
                                            hideTag={section.id !== "all"}
                                          />
                                        ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
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
                                  onComplete={handleCompleteTask}
                                  onDelete={handleDeleteTask}
                                  onEdit={handleEditTask}
                                  onDoubleClickEdit={handleEditTask}
                                  onClick={() => setSelectedTaskId(task.id)}
                                  isSelected={selectedTaskId === task.id}
                                  hideTag={false}
                                  checked={true} // Force checked state for completed tasks
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
                                  onComplete={handleCompleteTask}
                                  onDelete={handleDeleteTask}
                                  onEdit={handleEditTask}
                                  onDoubleClickEdit={handleEditTask}
                                  onClick={() => setSelectedTaskId(task.id)}
                                  isSelected={selectedTaskId === task.id}
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
                      console.log('Sidebar: AgendaView date selected:', date);
                      // Ensure we're passing a fresh date object to prevent reference issues
                      onDateSelect(new Date(date));
                    }}
                    onTaskComplete={handleCompleteTask}
                    onTaskDelete={handleDeleteTask}
                    onTaskEdit={handleEditTask}
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
                        <div className="p-1">
                          <button
                            className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-[5px] font-medium text-xs text-red-500 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                            onClick={() => {
                              setTags((prevTags) => prevTags.filter((tag) => tag.id !== selectedTagId));
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
                      ? "bg-light-bg-lighter dark:bg-dark-bg-lighter"
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
                      ? "bg-light-bg-lighter dark:bg-dark-bg-lighter"
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
    </aside>
  );
}
