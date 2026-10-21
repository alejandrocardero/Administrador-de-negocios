import * as React from "react"
import { useId } from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type LabeledInputBaseProps = React.InputHTMLAttributes<HTMLInputElement>

export interface LabeledInputProps extends LabeledInputBaseProps {
  label: string
  error?: string
  /** Fallback si no se pasa `id`. */
  id?: string
  hint?: string
}

/** Campo de formulario canónico: label + input + hint/error con estados de foco y error accesibles. */
export function LabeledInput({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: LabeledInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId

  return (
    <div className="flex w-full flex-col gap-1.5">
      <Label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? `${inputId}-error` : null, hint ? `${inputId}-hint` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(
          "border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring",
          error && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
