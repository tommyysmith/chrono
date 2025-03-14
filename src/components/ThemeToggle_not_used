'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, systemTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  }, [theme, setTheme]);

  useEffect(() => {
    setMounted(true);

    const handleKeyDown = (e) => {
      // Check for CMD (Meta) + Shift + D
      if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleTheme();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  if (!mounted) {
    return null;
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 hover:bg-light-hover dark:hover:bg-dark-hover rounded-md text-light-text dark:text-dark-text relative group"
      title="Toggle theme (⌘⇧D)"
    >
      {theme === 'system' ? (
        <Monitor className="w-4 h-4" />
      ) : theme === 'light' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-2 py-1.5 bg-light-bg dark:bg-white/5 border border-light-border dark:border-dark-border shadow-lg text-light-text dark:text-dark-text text-xs font-medium rounded-[5px] whitespace-nowrap opacity-0 group-hover:opacity-100">
        {theme === 'system' ? 'System' : theme === 'light' ? 'Light' : 'Dark'} mode
      </div>
    </button>
  );
}
