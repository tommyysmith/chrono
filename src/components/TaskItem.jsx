'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import Checkbox from './Checkbox';
import { format } from 'date-fns';
import { Calendar } from '../assets/icons/Calendar';
import { Trash } from '../assets/icons/Trash';

export default function TaskItem({ task, onComplete, onDelete, onEdit, onDoubleClickEdit, onClick, isSelected }) {
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
    console.log('TaskItem clicked:', task.id);
    onClick?.(e);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    console.log('Context menu opened for task:', task.id);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleEdit = () => {
    console.log('Edit triggered for task:', task.id);
    onDoubleClickEdit(task);
    setShowContextMenu(false);
  };

  const handleDelete = () => {
    console.log('Delete triggered for task:', task.id);
    onDelete(task.id);
    setShowContextMenu(false);
  };

  return (
    <div 
      className={`task-item group flex items-top gap-2 p-2 ${isSelected ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'} rounded-md relative`}
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
      <div className="flex flex-col gap-1 flex-grow">
        <span className={`text-sm ${task.completed ? 'line-through opacity-50' : ''}`}>
          {task.title}
        </span>
        {task.scheduledDate && (
          <div className="inline-flex self-start items-center gap-1 mt-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
            <Calendar className="h-3 w-3" />
            {format(new Date(task.scheduledDate), 'd MMM')}
          </div>
        )}
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
