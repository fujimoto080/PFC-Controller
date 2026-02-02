import * as React from "react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const GradientCard = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Card>>(
  ({ className, ...props }, ref) => {
    return (
      <Card
        className={cn(
          "from-card to-secondary/10 relative overflow-hidden border-none bg-gradient-to-br shadow-md",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
GradientCard.displayName = "GradientCard"

export { GradientCard }
