import { motion, AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";
import { Trash } from "@/assets/icons/Trash";
import { EyeHidden } from "@/assets/icons/EyeHidden";

const TaskContextMenu = ({
  isOpen,
  position,
  task,
  onEdit,
  onDelete,
  onRemoveFromCalendar,
  onClose,
}) => {
  if (!isOpen || !task) return null;

  const handleEdit = () => {
    onEdit(task);
    onClose();
  };

  const handleDelete = () => {
    onDelete(task);
    onClose();
  };

  const handleRemoveFromCalendar = () => {
    onRemoveFromCalendar?.(task);
    onClose();
  };

  // Check if task is on calendar (has scheduledDate or addToCalendar flag)
  const isOnCalendar = task.scheduledDate || task.addToCalendar;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={onClose}
          />
          {/* Context Menu */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[200px] p-0 focus:outline-none focus-visible:outline-none"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            <div className="space-y-0.5">
              <button
                onClick={handleEdit}
                className="w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all focus:outline-none focus-visible:outline-none"
              >
                <Pencil className="w-3 h-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
                Edit
              </button>
              {isOnCalendar && !(task.isRepeat === true || task.seriesId || (task.repeat && task.repeat !== 'none')) && (
                <button
                  onClick={handleRemoveFromCalendar}
                  className="w-full group text-left text-primary dark:text-primary px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all focus:outline-none focus-visible:outline-none"
                >
                  <EyeHidden className="w-3 h-3 text-primary/50 dark:text-primary/50 group-hover:text-primary dark:group-hover:text-primary" />
                  Remove from calendar
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full group text-left px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs text-[#EC0F0F] hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white focus:outline-none focus-visible:outline-none"
              >
                <Trash className="w-3 h-3 text-[#EC0F0F] group-hover:text-white group-hover:dark:text-white" />
                Delete
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TaskContextMenu; 