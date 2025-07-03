import "./globals.css";
import { Inter } from "next/font/google";
import { CalendarDataProvider } from "@/components/CalendarDataProvider";
import { TauriProvider } from "@/components/TauriProvider";
import ConvexClientProvider from "@/components/ConvexClientProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Chrono",
  description: "A modern calendar and task management application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexClientProvider>
          <TauriProvider>
            <CalendarDataProvider>
              {children}
            </CalendarDataProvider>
          </TauriProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
