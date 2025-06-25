"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { isToday, parseISO } from "date-fns";
import { useReward } from "react-rewards";
import { Add } from "../assets/icons/Add";

const TodaysTasksProgress = ({ tasks = {}, onAddTask }) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [hasReachedHundred, setHasReachedHundred] = useState(false);
  const { reward, isAnimating } = useReward('confettiReward', 'confetti', {
    elementCount: 80,
    spread: 60,
    startVelocity: 35,
    lifetime: 300,
    angle: 90,
    colors: ['#A45BF1', '#25C6F6', '#72F753', '#F76C88', '#F5F770']
  });

  // Calculate today's tasks and completion percentage
  const { todaysTasks, completedTasks, progressPercentage } = useMemo(() => {
    // Get all tasks from both 'all' and 'completed' collections to ensure we count everything
    const allTasks = [...(tasks.all || []), ...(tasks.completed || [])];
    
    // Filter tasks scheduled for today (including completed ones)
    const todaysTasks = allTasks.filter(task => {
      if (!task.scheduledDate) return false;
      try {
        const taskDate = parseISO(task.scheduledDate);
        return isToday(taskDate);
      } catch (error) {
        return false;
      }
    });

    // Remove duplicates (in case a task appears in both collections)
    const uniqueTodaysTasks = todaysTasks.reduce((unique, task) => {
      if (!unique.find(t => t.id === task.id)) {
        unique.push(task);
      }
      return unique;
    }, []);

    const completedTasks = uniqueTodaysTasks.filter(task => task.completed);
    const progressPercentage = uniqueTodaysTasks.length > 0 
      ? Math.round((completedTasks.length / uniqueTodaysTasks.length) * 100)
      : 0;

    return {
      todaysTasks: uniqueTodaysTasks,
      completedTasks,
      progressPercentage
    };
  }, [tasks]);

  // Animate progress bar when percentage changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [progressPercentage]);

  // Trigger confetti when reaching 100% for the first time
  useEffect(() => {
    if (progressPercentage === 100 && !hasReachedHundred && todaysTasks.length > 0) {
      setHasReachedHundred(true);
      // Delay confetti slightly to let progress bar animation complete
      setTimeout(() => {
        reward();
      }, 300);
    } else if (progressPercentage < 100) {
      setHasReachedHundred(false);
    }
  }, [progressPercentage, hasReachedHundred, reward, todaysTasks.length]);



  return (
    <div>
      <div className="bg-light-bg-lighter min-h-0 p-0.5 dark:bg-dark-bg-lighter rounded-[7px]">
        {/* Header */}
        <div className="bg-light-bg dark:bg-dark-bg-light shadow-sm w-fill p-2 rounded-[5px]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-medium text-light-text dark:text-dark-text">
            Today's tasks
          </h3>
          <span className="text-xs text-light-text/60 dark:text-dark-text/60">
            {progressPercentage}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="relative">
          <div className="w-full bg-light-border dark:bg-dark-border rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: `${animatedProgress}%` }}
              transition={{
                duration: 0.2,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
            />
          </div>
          {/* Confetti origin point - positioned at the end of progress bar */}
          <span 
            id="confettiReward" 
            className="absolute top-1 right-0 w-0 h-0"
            style={{ pointerEvents: 'none' }}
          />
        </div>
        </div>

        {/* Task Count */}
        <div className="flex items-center justify-between text-xs p-2 pr-1 pb-1 text-light-text/60 dark:text-dark-text/60">
          <span>{completedTasks.length}/{todaysTasks.length} Completed</span>
          <button
            onClick={() => onAddTask && onAddTask('today')}
            className="flex items-center justify-center p-1 h-6 rounded-[5px] hover:bg-light-border dark:hover:bg-dark-border transition-colors opacity-60 hover:opacity-100"
          >
            <Add className="w-3 h-3" />
            <span className="text-xs p-1">Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TodaysTasksProgress;