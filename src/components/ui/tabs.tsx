import * as TabsPrimitive from '@radix-ui/react-tabs';
import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.List ref={ref} className={cn('inline-flex h-10 items-center justify-center rounded-md bg-slate-100 p-1 text-sm', className)} {...props} />
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition focus-visible:outline-none data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow',
        className
      )}
      {...props}
    />
  )
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
  )
);
TabsContent.displayName = TabsPrimitive.Content.displayName;
