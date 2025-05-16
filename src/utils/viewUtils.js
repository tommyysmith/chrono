// /Users/tommysmith/Documents/chrono/src/utils/viewUtils.js

const VIEWS_KEY = 'chrono_views';
const ACTIVE_VIEW_IDS_KEY = 'chrono_active_view_ids';
const DEFAULT_VIEW_ID = 'default-personal';

export const loadViews = () => {
  try {
    const viewsData = localStorage.getItem(VIEWS_KEY);
    if (viewsData) {
      const parsedViews = JSON.parse(viewsData);
      // Ensure there's at least the default view if storage is somehow corrupted or empty array
      if (Array.isArray(parsedViews) && parsedViews.length > 0) {
        return parsedViews;
      }
    }
  } catch (error) {
    console.error("Error loading views from localStorage:", error);
    // Fallback to default if parsing fails
  }
  // Default if nothing in localStorage or if there was an error/empty array
  return [{ id: DEFAULT_VIEW_ID, name: 'Personal' }];
};

export const saveViews = (views) => {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch (error) {
    console.error("Error saving views to localStorage:", error);
  }
};

export const loadActiveViewIds = () => {
  try {
    const activeViewIdsData = localStorage.getItem(ACTIVE_VIEW_IDS_KEY);
    if (activeViewIdsData) {
      const parsedActiveViewIds = JSON.parse(activeViewIdsData);
      // Ensure it's an array and if it's empty, consider defaulting
      if (Array.isArray(parsedActiveViewIds)) {
        // If you want to ensure at least one view is active by default:
        // if (parsedActiveViewIds.length === 0) {
        //   return [DEFAULT_VIEW_ID];
        // }
        return parsedActiveViewIds;
      }
    }
  } catch (error) {
    console.error("Error loading active view IDs from localStorage:", error);
  }
  // Default if nothing in localStorage or error
  return [DEFAULT_VIEW_ID];
};

export const saveActiveViewIds = (activeViewIds) => {
  try {
    localStorage.setItem(ACTIVE_VIEW_IDS_KEY, JSON.stringify(activeViewIds));
  } catch (error) {
    console.error("Error saving active view IDs to localStorage:", error);
  }
};

export const getDefaultViewId = () => DEFAULT_VIEW_ID;
