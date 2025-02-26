"use client";
import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Chevron } from "../../assets/icons/Chevron";
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}) {
  return (
    (<DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-[280px]", className)}
      classNames={{
        root: "w-full pt-2 pb-2",
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4 w-full",
        caption: "flex justify-between relative items-center pl-4 pr-1",
        caption_label: "text-sm font-semibold text-dark-text dark:text-dark-text",
        nav: "flex items-center",
        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-dark-text dark:text-dark-text flex items-center justify-center",
        nav_button_previous: "rotate-180",
        nav_button_next: "",
        table: "w-full border-collapse space-y-2",
        head_row: "flex w-full justify-between gap-2 px-2",
        head_cell: "text-dark-text/50 dark:text-dark-text/50 rounded-md w-7 font-normal text-[0.8rem] text-center",
        row: "flex w-full justify-between gap-2 px-2 py-1",
        cell: "text-center text-xs p-0 relative focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-7 w-7 p-0 font-normal text-light-text dark:text-dark-text hover:!bg-white/15 dark:hover:bg-white/5 rounded-[5px]"
        ),
        day_range_end: "day-range-end",
        day_selected: "!bg-white/15 dark:bg-dark-bg !border !border-dark-border dark:border-dark-border text-light-text dark:text-dark-text hover:bg-primary  focus:bg-primary focus:text-primary-foreground rounded-[5px]",
        day_today: "!bg-primary !text-dark-text dark:text-dark-text hover:!bg-primary rounded-[5px]",
        day_outside: "!text-dark-text/30 !dark:text-dark-text/30",
        day_disabled: "!text-dark-text/30 dark:!text-dark-text/30 opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => (
          <Chevron className="h-4 w-4 text-light-text/50 dark:text-dark-text/50" {...props} />
        ),
        IconRight: ({ ...props }) => (
          <Chevron className="h-4 w-4 text-light-text/50 dark:text-dark-text/50" {...props} />
        ),
      }}
      {...props} />)
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
