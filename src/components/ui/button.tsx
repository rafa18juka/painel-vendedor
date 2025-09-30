import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '../../utils/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/20 px-5 py-2.5 font-medium text-sm text-slate-800 shadow backdrop-blur-md transition-all duration-200 hover:bg-white/30 hover:shadow-lg active:scale-[0.98] focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-white/60 focus-visible:ring-2 focus-visible:ring-white/60 disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        default: '',
        outline: '',
        ghost: '',
        destructive: 'text-red-600'
      },
      size: {
        default: '',
        sm: 'px-4 py-2 text-xs',
        lg: 'px-6 py-3 text-base',
        icon: 'grid place-items-center gap-0 px-0 py-0 w-9 h-9 text-slate-800 hover:shadow-md'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { buttonVariants };
