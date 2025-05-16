// /Users/tommysmith/Documents/chrono/src/components/ViewsPopover.jsx
import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button'; // Assuming a Button component exists in ui
import { Checkbox } from './ui/checkbox'; // Assuming a Checkbox component exists in ui
import { Input } from './ui/input'; // Assuming an Input component exists in ui
import { Plus, MoreHorizontal, Edit3, Trash2, ChevronDown } from 'lucide-react'; // Icons
import { useCalendar } from './CalendarDataProvider';

export const ViewsPopover = ({ 
  triggerClassName = "w-full justify-start px-3 text-sm", // Default class if not provided
  triggerLabel = "Views" // Default label if not provided
}) => {
  const {
    views,
    activeViewIds,
    addView,
    renameView, // We'll integrate this later
    deleteView, // We'll integrate this later
    toggleView,
    isLoading,
    getDefaultViewId
  } = useCalendar();

  const [newViewName, setNewViewName] = useState('');
  const [editingViewId, setEditingViewId] = useState(null); // For inline rename
  const [editingViewName, setEditingViewName] = useState(''); // For inline rename

  const handleAddNewView = () => {
    if (newViewName.trim()) {
      addView(newViewName.trim());
      setNewViewName('');
    }
  };

  const handleStartRename = (view) => {
    setEditingViewId(view.id);
    setEditingViewName(view.name);
  };

  const handleRenameView = () => {
    if (editingViewId && editingViewName.trim()) {
      renameView(editingViewId, editingViewName.trim());
      setEditingViewId(null);
      setEditingViewName('');
    }
  };
  
  const defaultViewId = getDefaultViewId ? getDefaultViewId() : 'default-personal';


  if (isLoading) {
    return (
      <Button variant="outline" className="w-full justify-start px-3 text-sm">
        Loading Views...
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Use a div with passed className and label, plus a chevron icon */}
        <div className={triggerClassName}>
          <span className="text-xs px-0.5 font-medium text-light-text dark:text-dark-text">
            {triggerLabel}
          </span>
          <ChevronDown className="w-4 h-4 ml-2 text-light-text/50 dark:text-dark-text/50" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 bg-dark-bg-lighter p-2 mr-3 space-y-2 rounded-[5px]">
        <div className="text-xs text-dark-text font-medium px-2 py-1">Manage Views</div>
        
        {/* List existing views */}
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {views.map((view) => (
            <div key={view.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md group">
              <div className="flex items-center space-x-2 flex-grow">
                <Checkbox
                  id={`view-toggle-${view.id}`}
                  checked={activeViewIds.includes(view.id)}
                  onCheckedChange={() => toggleView(view.id)}
                  aria-label={`Toggle view ${view.name}`}
                />
                {editingViewId === view.id ? (
                  <Input
                    type="text"
                    value={editingViewName}
                    onChange={(e) => setEditingViewName(e.target.value)}
                    onBlur={handleRenameView}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameView()}
                    className="h-7 px-1 text-sm flex-grow"
                    autoFocus
                  />
                ) : (
                  <label
                    htmlFor={`view-toggle-${view.id}`}
                    className="text-sm cursor-pointer flex-grow"
                    onDoubleClick={() => view.id !== defaultViewId && handleStartRename(view)}
                  >
                    {view.name}
                  </label>
                )}
              </div>
              {view.id !== defaultViewId && ( // Don't allow editing/deleting the default view
                <Popover>
                    <PopoverTrigger asChild className="opacity-0 group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-1">
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-xs px-2 py-1"
                            onClick={() => handleStartRename(view)}
                        >
                            <Edit3 className="mr-2 h-3 w-3" /> Rename
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full justify-start text-xs px-2 py-1 text-red-500 hover:text-red-600"
                            onClick={() => {
                                if (window.confirm(`Are you sure you want to delete the view "${view.name}"? Events in this view will be moved to "Personal".`)) {
                                    deleteView(view.id);
                                }
                            }}
                        >
                            <Trash2 className="mr-2 h-3 w-3" /> Delete
                        </Button>
                    </PopoverContent>
                </Popover>
              )}
            </div>
          ))}
        </div>

        {/* Add new view section */}
        <div className="pt-2 border-t border-muted">
          <div className="flex items-center space-x-2 px-1">
            <Input
              type="text"
              placeholder="New view name..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNewView()}
              className="h-8 text-sm"
            />
            <Button onClick={handleAddNewView} size="sm" className="px-2.5">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
