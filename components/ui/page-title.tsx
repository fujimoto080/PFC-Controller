import { cn } from '@/lib/utils';

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function PageTitle({ children, className, ...props }: PageTitleProps) {
  return (
    <h1
      className={cn(
        'text-2xl font-bold tracking-tight py-2 mb-6 px-4',
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}
