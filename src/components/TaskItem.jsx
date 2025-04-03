'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, CalendarClock } from 'lucide-react';
import Checkbox from './Checkbox';
import { format } from 'date-fns';
import { Calendar } from '../assets/icons/Calendar';
import { Trash } from '../assets/icons/Trash';
import { Tag } from '../assets/icons/Tag';
import { More } from '../assets/icons/More';
import { Repeat } from '../assets/icons/Repeat';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export default function TaskItem({ task, onComplete, onDelete, onEdit, onDoubleClickEdit, onClick, hideScheduledDate, hideTag, isRecurring, checked }) {
  // If isRecurring is not explicitly passed, check the task properties
  const taskIsRecurring = isRecurring !== undefined ? isRecurring : (task.repeat && task.repeat !== 'none');
  const [isHovering, setIsHovering] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const taskItemRef = useRef(null);

  const handleClick = (e) => {
    // Don't trigger selection when clicking checkbox
    if (e.target.closest('.checkbox')) {
      return;
    }

    onClick?.(e);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    setIsPopoverOpen(true);
  };

  const handleEdit = () => {
    onDoubleClickEdit(task);
    setIsPopoverOpen(false);
  };

  const handleDelete = () => {
    onDelete(task.id);
    setIsPopoverOpen(false);
  };

  return (
    <div 
      ref={taskItemRef}
      className="task-item select-none cursor-pointer flex items-top gap-2 p-2 hover:bg-light-bg-light dark:hover:bg-dark-bg-lighter rounded-[11px] relative"
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={() => onDoubleClickEdit(task)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => {
        setIsHovering(false);
        setIsPopoverOpen(false);
      }}
    >
      <div className="checkbox flex-shrink-0 mt-0.5">
        <Checkbox 
          checked={checked !== undefined ? checked : task.completed}
          onChange={() => onComplete(task.id)}
        />
      </div>
      <div className="flex flex-col flex-grow">
        <span className={`text-sm ${task.completed ? 'line-through opacity-50' : ''}`}>
          {task.title}
        </span>
        <div className="flex items-center flex-row gap-1">
        {!hideScheduledDate && task.scheduledDate && (
          <div className="inline-flex self-start mt-1 items-center px-1.5 py-1 text-xs rounded-[5px] bg-primary/10 text-primary">
            <Calendar className="h-3 w-3" />
            <span className="px-1">
            {format(new Date(task.scheduledDate), 'd MMM')}
            </span>
          </div>
        )}
        {taskIsRecurring && (
          <div className="inline-flex self-start mt-1 items-center px-1.5 h-[24px] text-xs rounded-[5px] bg-blue-500/10 text-blue-500">
            <Repeat className="h-3 w-3" />
          </div>
        )}
        {!hideTag && task.tag && (
          <div 
            key={`tag-${task.tag.id || 'default'}`}
            className="flex flex-wrap gap-1"
          >
            <div
              className="inline-flex self-start mt-1 items-center px-1.5 py-1 text-xs rounded-[5px]"
              style={{
                backgroundColor: `${task.tag.color}15`,
                color: task.tag.color
              }}
            >
              <Tag className="h-3 w-3"
              style={{ color: task.tag.color }} />
              <span className="px-1">
              {task.tag.label}
              </span>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* More icon shown on hover */}
      <AnimatePresence>
        {isHovering && (
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="flex group h-[24px] w-[24px] px-1 py-1 rounded-[5px] items-center hover:bg-light-bg-lighter dark:hover:bg-white/5"
              >
                <More className="w-4 h-4 text-light-text/50 dark:text-dark-text/50 group-hover:text-light-text dark:group-hover:text-dark-text" />
              </motion.button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1 min-w-[120px] bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border">
              <div className="flex flex-col gap-1">
                <button
                  onClick={handleEdit}
                  className="w-full px-2 py-1 text-xs text-dark-text dark:text-dark-text rounded-[5px] flex items-center gap-2 hover:bg-white/15 dark:hover:bg-white/5"
                >
                  <Pencil className="w-3 h-3 text-dark-text dark:text-dark-text" />
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="group w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white hover:font-semibold text-[#EC0F0F]"
                >
                  <Trash className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </AnimatePresence>
    </div>
  );
}
