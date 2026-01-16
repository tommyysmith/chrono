import { ThemeProvider } from "next-themes";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/react"
import { ConvexClientProvider } from "../components/ConvexClientProvider";

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Chrono - Task & Calendar Management",
  description: "A modern task and calendar management application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-light-bg-light dark:bg-dark-bg`}
      >
        <Analytics />
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="min-h-screen bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text">
              {children}
          <SpeedInsights />

            </div>
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
