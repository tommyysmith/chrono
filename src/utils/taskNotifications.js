/**
 * Simple notification utility for task scheduling feedback
 */

export const showTaskNotification = (message, type = 'success') => {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.className = `
    fixed top-4 right-4 z-[9999] px-3 py-2 rounded-[9px] shadow-lg 
    transition-all duration-300 transform translate-x-full text-sm font-medium
    ${type === 'success' 
      ? 'bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700/50' 
      : 'bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/50'
    }
  `;
  notification.textContent = message;
  
  // Add to DOM
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translate-x-0';
  }, 10);
  
  // Animate out and remove
  setTimeout(() => {
    notification.style.transform = 'translate-x-full';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2500); // Reduced duration to 2.5 seconds
};

export const showTaskRescheduledNotification = (taskTitle, newDate) => {
  const formattedDate = new Date(newDate).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  
  showTaskNotification(`"${taskTitle}" rescheduled to ${formattedDate}`, 'success');
}; 