'use client';

import { ThemeProvider } from 'next-themes';
import { TauriProvider } from '../components/TauriProvider';
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      <script
          crossOrigin="anonymous"
          src="//unpkg.com/react-scan/dist/auto.global.js"
        />
      </head>
      <body className="antialiased">
        <TauriProvider>
          <ThemeProvider 
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
              {children}
            </div>
          </ThemeProvider>
        </TauriProvider>
      </body>
    </html>
  );
}
