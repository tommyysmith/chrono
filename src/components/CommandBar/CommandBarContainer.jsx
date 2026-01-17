'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useCommandBar, VIEW_MODES } from './CommandBarContext';

// Click outside handler hook
function useClickOutside(ref, handler, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    
    // Delay attaching the listener to avoid race conditions with drag-to-create
    const timeoutId = setTimeout(() => {
      const handleClick = (e) => {
        if (ref.current && !ref.current.contains(e.target)) {
          // Don't trigger if clicking on calendar events or other interactive elements
          const isCalendarEvent = e.target.closest('[data-event-id]');
          const isPopover = e.target.closest('[data-radix-popper-content-wrapper]');
          const isModal = e.target.closest('[role="dialog"]');
          if (!isCalendarEvent && !isPopover && !isModal) {
            handler();
          }
        }
      };
      
      document.addEventListener('mousedown', handleClick);
      ref.current._clickOutsideHandler = handleClick;
    }, 150);
    
    return () => {
      clearTimeout(timeoutId);
      if (ref.current?._clickOutsideHandler) {
        document.removeEventListener('mousedown', ref.current._clickOutsideHandler);
      }
    };
  }, [ref, handler, enabled]);
}

// Base dimensions for different modes
const MODE_DIMENSIONS = {
  [VIEW_MODES.DEFAULT]: { width: 'auto', height: 52 },
  [VIEW_MODES.TASK]: { width: 450, height: 'auto' },
  [VIEW_MODES.EVENT]: { width: 550, height: 'auto' },
  [VIEW_MODES.GO_TO_DATE]: { width: 450, height: 'auto' },
  [VIEW_MODES.MULTI_SELECT]: { width: 'auto', height: 52 },
};

export default function CommandBarContainer({ children, onClickOutside }) {
  const { mode, shouldShow, isExpanded, close } = useCommandBar();
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 52 });
  const resizeObserverRef = useRef(null);
  const rafRef = useRef(null);

  // Handle click outside - close forms when clicking outside
  const handleClickOutside = useCallback(() => {
    if (mode === VIEW_MODES.TASK || mode === VIEW_MODES.EVENT || mode === VIEW_MODES.GO_TO_DATE) {
      close();
    }
    onClickOutside?.();
  }, [mode, close, onClickOutside]);

  useClickOutside(containerRef, handleClickOutside, mode !== VIEW_MODES.DEFAULT && mode !== VIEW_MODES.MULTI_SELECT);

  // Measure content and update dimensions
  const measureContent = useCallback(() => {
    if (!contentRef.current) return;
    
    const { width, height } = contentRef.current.getBoundingClientRect();
    
    // Cancel any pending RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    // Use RAF to batch dimension updates
    rafRef.current = requestAnimationFrame(() => {
      setDimensions(prev => {
        // Only update if dimensions actually changed (threshold of 1px)
        if (Math.abs(prev.width - width) > 1 || Math.abs(prev.height - height) > 1) {
          return { width, height };
        }
        return prev;
      });
    });
  }, []);

  // Set up ResizeObserver
  useEffect(() => {
    if (!contentRef.current) return;

    resizeObserverRef.current = new ResizeObserver(measureContent);
    resizeObserverRef.current.observe(contentRef.current);

    // Initial measurement
    measureContent();

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [measureContent]);

  // Re-measure when mode changes
  useEffect(() => {
    measureContent();
  }, [mode, measureContent]);

  // Calculate container styles
  const containerStyle = {
    width: mode === VIEW_MODES.DEFAULT || mode === VIEW_MODES.MULTI_SELECT 
      ? (dimensions.width || 'auto')
      : dimensions.width + 32, // Add padding for forms
    height: Math.max(dimensions.height || 52, 52),
    opacity: shouldShow ? 1 : 0,
    transform: shouldShow ? 'translateY(0) scale(1)' : 'translateY(60px) scale(0.95)',
    pointerEvents: shouldShow ? 'auto' : 'none',
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex justify-center">
      <div
        ref={containerRef}
        data-command-bar
        className={`
          bg-light-bg dark:!bg-dark-bg-lighter 
          overflow-hidden shadow-lg rounded-[13px] 
          outline outline-1 outline-light-border dark:outline-dark-border 
          dark:hover:bg-white/10 border-light-border dark:border-dark-border
          transition-all duration-150 ease-out
          ${isExpanded ? 'px-4' : 'px-0'}
        `}
        style={{
          ...containerStyle,
          willChange: 'transform, opacity, width, height',
          transformOrigin: 'bottom center',
        }}
      >
        <div
          ref={contentRef}
          className="relative flex flex-col"
          style={{
            width: 'max-content',
            minHeight: 52,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
