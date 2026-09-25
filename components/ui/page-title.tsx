import { cn } from '@/lib/utils';

interface PageTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export function PageTitle({ children, className, ...props }: PageTitleProps) {
  return (
    <h1
      className={cn(
        'mb-6 px-4 py-2 text-2xl font-bold tracking-tight',
        className,
      )}
      {...props}
    >
      {children}
    </h1>
  );
}
