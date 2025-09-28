import { cn } from '../../utils/cn';

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center rounded-full border border-transparent bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700', className)} {...props} />;
}
