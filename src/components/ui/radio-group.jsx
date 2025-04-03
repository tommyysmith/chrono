"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef(({ className, ...props }, ref) => {
  return (<RadioGroupPrimitive.Root className={cn("grid gap-2", className)} {...props} ref={ref} />);
})
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

const RadioGroupItem = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      // Apply styles to match RepeatEditModal custom radio buttons
      className={cn(
        "aspect-square h-4 w-4 rounded-full border-2", // Base size, shape, border
        "data-[state=unchecked]:bg-transparent data-[state=unchecked]:border-light-border data-[state=unchecked]:dark:border-dark-border", // Unchecked state
        "data-[state=checked]:bg-primary data-[state=checked]:border-primary", // Checked state
        "disabled:cursor-not-allowed disabled:opacity-50", // Disabled state
        className
      )}
      {...props}>
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        {/* Use a simple div for the inner dot, matching RepeatEditModal */}
        <div className="h-2 w-2 rounded-full bg-white dark:bg-dark-bg-lighter" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
})
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName

export { RadioGroup, RadioGroupItem }
