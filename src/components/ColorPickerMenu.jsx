import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash } from '../assets/icons/Trash';

export default function ColorPickerMenu({ 
  isOpen, 
  onClose, 
  position, 
  colors, 
  onSelectColor,
  onDelete 
}) {
  const menuRef = useRef();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="bg-light-bg dark:bg-dark-bg-lighter shadow-lg rounded-[9px] border border-light-border dark:border-dark-border"
          style={{
            position: 'fixed',
            left: position?.x ?? 0,
            top: position?.y ?? 0,
            zIndex: 50,
            maxWidth: '280px',
          }}
        >
          <div className="px-3 pt-2 pb-1 text-xs text-light-text/50 dark:text-dark-text/50 font-medium">
            Color
          </div>
          <div className="flex flex-wrap gap-2 p-3">
            {colors.map((color) => (
              <motion.div
                key={color}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-5 h-5 rounded-[5px] cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-light-border dark:hover:ring-dark-border transition-all"
                style={{ backgroundColor: color }}
                onClick={() => onSelectColor(color)}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ))}
          </div>
          {onDelete && (
            <>
              <div className="border-t border-light-border dark:border-dark-border mt-2" />
              <div className="p-1">
                <button
                  className="w-full flex items-center gap-2 text-left px-2 py-2 rounded-[5px] font-medium text-sm text-red-500 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white"
                  onClick={onDelete}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Trash className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
