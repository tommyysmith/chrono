'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import Checkbox from './Checkbox';
import { format } from 'date-fns';
import { Calendar } from '../assets/icons/Calendar';
import { Trash } from '../assets/icons/Trash';
import { Tag } from '../assets/icons/Tag';

export default function TaskItem({ task, onComplete, onDelete, onEdit, onDoubleClickEdit, onClick, isSelected, hideScheduledDate, hideTag }) {
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);

  const contextMenuRef = useRef(null);

 


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  const handleClick = (e) => {
    // Don't trigger selection when clicking checkbox or context menu
    if (e.target.closest('.checkbox') || contextMenuRef.current?.contains(e.target)) {
      return;
    }

    onClick?.(e);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();

    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleEdit = () => {

    onDoubleClickEdit(task);
    setShowContextMenu(false);
  };

  const handleDelete = () => {

    onDelete(task.id);
    setShowContextMenu(false);
  };

  return (
    <div 
      className={`task-item group flex items-top gap-2 p-2 ${isSelected ? 'bg-light-bg-light dark:bg-dark-bg-lighter' : 'hover:bg-light-bg-light dark:hover:bg-dark-bg-lighter'} rounded-md relative`}
      onContextMenu={handleContextMenu}
      onClick={handleClick}
      onDoubleClick={() => onDoubleClickEdit(task)}
    >
      <div className="checkbox flex-shrink-0 mt-0.5">
        <Checkbox 
          checked={task.completed}
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

      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.05 }}
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
            }}
            className="z-50 min-w-[120px] p-1 flex flex-col gap-1 bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border"
          >
            <button
              onClick={handleEdit}
              className="w-full px-2 py-1 text-xs text-dark-text dark:text-dark-text rounded-[5px] flex items-center gap-2 hover:bg-white/15 dark:hover:bg-white/5"
            >
              <Pencil className="w-3 h-3 text-dark-text dark:text-dark-text" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="group w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2  hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white hover:font-semibold text-[#EC0F0F]"
            >
              <Trash className="w-3 h-3" />
             Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
