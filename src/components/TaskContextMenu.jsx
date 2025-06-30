import { motion, AnimatePresence } from "framer-motion";
import { Pencil } from "lucide-react";
import { Trash } from "@/assets/icons/Trash";

const TaskContextMenu = ({
  isOpen,
  position,
  task,
  onEdit,
  onDelete,
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
            className="fixed z-50 w-auto p-1 min-w-[120px] bg-dark-bg-lighter dark:bg-dark-bg rounded-[9px] shadow-md border border-light-border dark:border-dark-border"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
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
                className="group w-full px-2 py-1 text-xs rounded-[5px] flex items-center gap-2 hover:bg-[#EC0F0F] dark:hover:bg-[#BE2020] hover:text-white text-[#EC0F0F]"
              >
                <Trash className="w-3 h-3" />
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