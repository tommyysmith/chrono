"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

// Create dropdown menu components using Popover primitives
const DropdownMenu = React.forwardRef(({ children, ...props }, ref) => {
  return (
    <PopoverPrimitive.Root {...props}>
      {children}
    </PopoverPrimitive.Root>
  )
})
DropdownMenu.displayName = "DropdownMenu"

const DropdownMenuTrigger = PopoverPrimitive.Trigger

const DropdownMenuContent = React.forwardRef(({ className, align = "start", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "bg-dark-bg-lighter space-y-0.5 dark:bg-dark-bg shadow-lg rounded-[9px] outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-0 focus:outline-none focus-visible:outline-none z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props} />
  </PopoverPrimitive.Portal>
))
DropdownMenuContent.displayName = "DropdownMenuContent"

const DropdownMenuItem = React.forwardRef(({ className, children, onClick, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-regular text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all",
      className
    )}
    onClick={onClick}
    {...props}
  >
    {children}
  </button>
))
DropdownMenuItem.displayName = "DropdownMenuItem"

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("h-px bg-dark-border my-0.5", className)}
    {...props} />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

// Custom submenu implementation using nested Popovers
const DropdownMenuSub = ({ children }) => {
  return <>{children}</>
}

const DropdownMenuSubTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(false)
  
  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          ref={ref}
          className={cn(
            "w-full group text-left text-dark-text dark:text-dark-text px-2 py-1.5 flex flex-row gap-2 items-center rounded-[5px] font-medium text-xs hover:bg-white/15 dark:hover:bg-white/5 transition-all focus:outline-none focus-visible:outline-none",
            className
          )}
          {...props}
        >
          {children}
          <ChevronRight className="ml-auto h-3 w-3 text-dark-text/50 dark:text-dark-text/50 group-hover:text-dark-text dark:group-hover:text-dark-text" />
        </button>
      </PopoverPrimitive.Trigger>
      {props.children}
    </PopoverPrimitive.Root>
  )
})
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger"

const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      side="right"
      align="start"
      sideOffset={5}
      className={cn(
        "bg-dark-bg-lighter dark:bg-dark-bg shadow-lg rounded-[9px] overflow-hidden outline outline-[1px] outline-dark-border dark:outline-dark-border outline-offset-0 w-[180px] p-0 focus:outline-none focus-visible:outline-none z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props} />
  </PopoverPrimitive.Portal>
))
DropdownMenuSubContent.displayName = "DropdownMenuSubContent"

// Unused components for compatibility
const DropdownMenuGroup = ({ children }) => <>{children}</>
const DropdownMenuPortal = ({ children }) => <>{children}</>
const DropdownMenuRadioGroup = ({ children }) => <>{children}</>
const DropdownMenuCheckboxItem = DropdownMenuItem
const DropdownMenuRadioItem = DropdownMenuItem
const DropdownMenuLabel = ({ className, children, ...props }) => (
  <div className={cn("px-2 py-1.5 text-xs font-semibold text-dark-text/70 dark:text-dark-text/70", className)} {...props}>
    {children}
  </div>
)
const DropdownMenuShortcut = ({ className, children, ...props }) => (
  <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props}>
    {children}
  </span>
)

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
} 