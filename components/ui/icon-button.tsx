import * as React from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('shrink-0', className)}
        ref={ref}
        {...props}
      />
    );
  }
);
IconButton.displayName = 'IconButton';

export { IconButton };
