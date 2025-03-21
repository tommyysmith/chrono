"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { format, isToday, isTomorrow } from "date-fns";
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
import ColorPickerMenu from "./ColorPickerMenu";
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
import AgendaView from "./AgendaView";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { More } from "../assets/icons/More";

export default function Sidebar({
  commandBarRef,
  events = [],
  selectedDate,
  onDateSelect,
  setIsVisible,
}) {
  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks' or 'agenda'
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

  const [selectedView, setSelectedView] = useState("all"); // 'all', 'today', or 'upcoming'
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
      // Update in all collections
      Object.keys(newTasks).forEach((group) => {
        if (Array.isArray(newTasks[group])) {
          newTasks[group] = newTasks[group].map((task) =>
            task.id === taskId ? { ...task, completed: !task.completed } : task
          );
        }
      });
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
    } else if (selectedView === "today") {
      return allTasksArray
        .filter((task) => {
          if (!task.scheduledDate) return false;
          const taskDate = new Date(task.scheduledDate);
          return isToday(taskDate);
        })
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    } else {
      // Get all scheduled tasks that are not today
      return allTasksArray
        .filter((task) => {
          if (!task.scheduledDate) return false;
          const taskDate = new Date(task.scheduledDate);
          return !isToday(taskDate);
        })
        .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate));
    }
  };

  return (
    
    <aside className="w-[280px] min-w-[280px] h-full border-r border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg overflow-y-auto relative flex flex-col">
      <div className="h-full flex flex-col">
        <div className="flex p-2">
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger asChild>
          <button
            onClick={() => setIsVisible(false)}
            className="flex group w-[32px] h-[32px] mr-2 items-center justify-center rounded-[7px] hover:bg-light-bg-lighter dark:hover:bg-dark-bg-lighter"
          >
            <SidebarIcon className="w-5 h-5 group-hover:text-light-text dark:group-hover:text-dark-text text-light-text/50 dark:text-dark-text/50" />
          </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close Sidebar</TooltipContent>
          </Tooltip>
          </TooltipProvider>
        </div>
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
                <div className="flex rounded-[9px] py-4 px-2">
                  <button
                    className={`flex w-auto px-3 py-2 text-xs rounded-[5px] ${
                      selectedView === "all"
                        ? "bg-light-bg-lighter font-semibold dark:bg-white/5"
                        : "text-light-text/50 dark:text-dark-text/50"
                    }`}
                    onClick={() => setSelectedView("all")}
                  >
                    All
                  </button>
                  <button
                    className={`flex w-auto px-3 py-2 text-xs rounded-[5px]  ${
                      selectedView === "today"
                        ? "bg-light-bg-lighter font-semibold dark:bg-white/5"
                        : "text-light-text/50 dark:text-dark-text/50"
                    }`}
                    onClick={() => setSelectedView("today")}
                  >
                    Today
                  </button>
                  <button
                    className={`flex w-auto px-3 py-2 text-xs rounded-[5px]  ${
                      selectedView === "upcoming"
                        ? "bg-light-bg-lighter font-semibold dark:bg-white/5"
                        : "text-light-text/50 dark:text-dark-text/50"
                    }`}
                    onClick={() => setSelectedView("upcoming")}
                  >
                    Upcoming
                  </button>
                </div>
                <nav className="flex-1 overflow-auto">
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
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
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
                                      const rect =
                                        e.currentTarget.getBoundingClientRect();
                                      setColorMenuPosition({
                                        x: e.clientX,
                                        y: e.clientY,
                                      });
                                      setSelectedTagId(section.id);
                                      setColorMenuOpen(true);
                                    }
                                  }}
                                  className="flex group px-1 py-1 rounded-[5px] items-center hover:bg-light-bg-lighter dark:hover:bg-white/5"
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
                      // Today and Upcoming views - chronological agenda
                      <div className="flex flex-col px-3 gap-1 mt-2">
                        {(() => {
                          const tasks = getTasksForView();
                          if (selectedView === "today") {
                            return tasks.map((task) => (
                              <TaskItem
                                key={task.id}
                                task={{
                                  ...task,
                                  tag: task.tag || null,
                                }}
                                onComplete={handleCompleteTask}
                                onDelete={handleDeleteTask}
                                onEdit={handleEditTask}
                                onClick={() => setSelectedTaskId(task.id)}
                                isSelected={selectedTaskId === task.id}
                                hideTag={false} // Show tags in Today/Upcoming views
                              />
                            ));
                          } else {
                            // Group tasks by date for Upcoming view
                            const tasksByDate = tasks.reduce((groups, task) => {
                              const date = new Date(task.scheduledDate);
                              const dateStr = format(date, "yyyy-MM-dd");
                              if (!groups[dateStr]) {
                                groups[dateStr] = [];
                              }
                              groups[dateStr].push(task);
                              return groups;
                            }, {});

                            return Object.entries(tasksByDate).map(
                              ([dateStr, dateTasks]) => {
                                const date = new Date(dateStr);
                                const today = new Date();
                                const tomorrow = new Date(today);
                                tomorrow.setDate(tomorrow.getDate() + 1);

                                let dateDisplay;
                                if (isToday(date)) {
                                  dateDisplay = "Today";
                                } else if (isTomorrow(date)) {
                                  dateDisplay = "Tomorrow";
                                } else {
                                  dateDisplay = format(date, "EEEE, MMMM d");
                                }

                                return (
                                  <div
                                    key={dateStr}
                                    className="flex flex-col gap-1"
                                  >
                                    <div className="px-2 py-1 text-xs font-medium text-light-text/50 dark:text-dark-text/50">
                                      {dateDisplay}
                                    </div>
                                    {dateTasks.map((task) => (
                                      <TaskItem
                                        key={task.id}
                                        task={{
                                          ...task,
                                          tag: task.tag || null,
                                        }}
                                        onComplete={handleCompleteTask}
                                        onDelete={handleDeleteTask}
                                        onEdit={handleEditTask}
                                        onClick={() =>
                                          setSelectedTaskId(task.id)
                                        }
                                        isSelected={selectedTaskId === task.id}
                                        hideTag={false} // Show tags in Today/Upcoming views
                                      />
                                    ))}
                                  </div>
                                );
                              }
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
                    onDateSelect={onDateSelect}
                    onTaskComplete={handleCompleteTask}
                    onTaskDelete={handleDeleteTask}
                    onTaskEdit={handleEditTask}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <ColorPickerMenu
          isOpen={colorMenuOpen}
          onClose={() => setColorMenuOpen(false)}
          position={colorMenuPosition}
          colors={TAG_COLORS}
          onSelectColor={(color) => {
            // Update the tag color
            setTags((prevTags) => {
              const updatedTags = prevTags.map((tag) =>
                tag.id === selectedTagId ? { ...tag, color: color } : tag
              );
              localStorage.setItem("tags", JSON.stringify(updatedTags));
              return updatedTags;
            });

            // Update all tasks that use this tag
            setTasks((prevTasks) => {
              const updatedTasks = { ...prevTasks };
              Object.keys(updatedTasks).forEach((group) => {
                if (Array.isArray(updatedTasks[group])) {
                  updatedTasks[group] = updatedTasks[group].map((task) =>
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
              localStorage.setItem("tasks", JSON.stringify(updatedTasks));
              return updatedTasks;
            });

            setColorMenuOpen(false);
          }}
          onDelete={
            selectedTagId
              ? () => {
                  setTags((prevTags) =>
                    prevTags.filter((tag) => tag.id !== selectedTagId)
                  );
                  setColorMenuOpen(false);
                }
              : undefined
          }
        />

        {/* Tab selector */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 border border-light-border dark:border-dark-border flex items-center gap-1 bg-light-bg dark:bg-dark-bg-lighter rounded-[9px] p-1 shadow-lg">
          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("tasks")}
                  className={`py-2 px-3 rounded-[5px] transition-colors duration-200 ${
                    activeTab === "tasks"
                      ? "bg-light-bg-lighter dark:bg-white/10"
                      : "hover:bg-light-bg-light dark:hover:bg-white/5"
                  }`}
                >
                  <Task
                    className={`w-5 h-5 ${
                      activeTab === "tasks"
                        ? "text-light-text dark:text-dark-text"
                        : "text-light-text/50 dark:text-dark-text/50"
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>Tasks</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setActiveTab("agenda")}
                  className={`py-2 px-3 rounded-[5px] transition-colors duration-200 ${
                    activeTab === "agenda"
                      ? "bg-light-bg-lighter dark:bg-white/10"
                      : "hover:bg-light-bg-light dark:hover:bg-white/5"
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
              <TooltipContent>Agenda</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </aside>

  );
}
