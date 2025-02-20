'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import Checkbox from './Checkbox';

export default function TaskItem({ task, onComplete, onDelete, onEdit, onDoubleClickEdit }) {
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
      className="group flex items-center gap-2 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-md relative"
      onContextMenu={handleContextMenu}
      onDoubleClick={() => onDoubleClickEdit(task)}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(task));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="flex-shrink-0">
        <Checkbox 
          checked={task.completed}
          onChange={() => onComplete(task.id)}
        />
      </div>
      <span className={`text-sm flex-grow ${task.completed ? 'line-through opacity-50' : ''}`}>
        {task.title}
      </span>

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
            className="z-50 min-w-[120px] p-1 flex flex-col gap-1 bg-light-bg dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border"
          >
            <button
              onClick={handleEdit}
              className="w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Pencil className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="group w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2  hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white hover:font-semibold text-[#EC0F0F]"
            >
              <Trash2 className="w-3 h-3" />
             Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
