"use client";

import { ThemeProvider } from "next-themes";
import { TauriProvider } from "../components/TauriProvider";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>

      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-light-bg-light dark:bg-dark-bg`}
      >
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
