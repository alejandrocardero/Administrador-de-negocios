import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface SkeletonCardsProps {
  count?: number
  className?: string
}

/** Placeholder de tarjetas con el mismo grid responsivo que el layout final de cards. */
export function SkeletonCards({
  count = 4,
  className,
}: SkeletonCardsProps) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-9 rounded-xl" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-7 w-2/5" />
            <Skeleton className="h-4 w-3/5" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
