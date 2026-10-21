import { useState, useRef, useCallback } from "react"
import { CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Async function to execute on click */
  onAction: () => void | Promise<void>
  /** Button content (text, icons, etc.) */
  children: React.ReactNode
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
  /** Callback after action completes successfully */
  onSuccess?: () => void
  /** Custom success message (default: "Completado") */
  successMessage?: string
  /** Duration to show success state in ms (default: 1500) */
  successDuration?: number
  /** Externally controlled disabled state */
  disabled?: boolean
  /** Show loading spinner instead of children while loading */
  showSpinner?: boolean
  /** Loading text (if showSpinner is false) */
  loadingText?: string
}

export function ActionButton({
  onAction,
  children,
  variant = "default",
  size = "default",
  onSuccess,
  successMessage = "Completado",
  successDuration = 1500,
  disabled = false,
  showSpinner = true,
  loadingText,
  className,
  ...props
}: ActionButtonProps) {
  const [state, setState] = useState<"idle" | "loading" | "success">("idle")
  const isMountedRef = useRef(true)

  const handleClick = useCallback(async () => {
    if (disabled || state !== "idle") return
    
    setState("loading")
    try {
      await onAction()
      if (!isMountedRef.current) return
      
      setState("success")
      onSuccess?.()
      
      // Reset to idle after success duration
      setTimeout(() => {
        if (isMountedRef.current) {
          setState("idle")
        }
      }, successDuration)
    } catch (error) {
      if (!isMountedRef.current) return
      setState("idle")
      throw error
    }
  }, [onAction, onSuccess, successDuration, disabled, state])

  const isLoading = state === "loading"
  const isSuccess = state === "success"
  const isDisabled = disabled || isLoading || isSuccess

  // Success state content
  if (isSuccess) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled={true}
        className={cn("bg-success text-success-foreground hover:bg-success/90", className)}
        {...props}
      >
        <CheckIcon className="size-4 shrink-0" aria-hidden />
        <span>{successMessage}</span>
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      disabled={isDisabled}
      onClick={handleClick}
      className={className}
      {...props}
    >
      {isLoading && showSpinner && (
        <Spinner className="size-4" aria-hidden />
      )}
      {isLoading && !showSpinner && loadingText && (
        <span>{loadingText}</span>
      )}
      {!isLoading && children}
    </Button>
  )
}

// Also export a simpler version for AlertDialog actions
export interface AlertActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onAction: () => void | Promise<void>
  children: React.ReactNode
  variant?: "default" | "destructive"
  disabled?: boolean
  loading?: boolean
}

export function AlertActionButton({
  onAction,
  children,
  variant = "default",
  disabled = false,
  loading = false,
  className,
  ...props
}: AlertActionButtonProps) {
  return (
    <Button
      variant={variant}
      disabled={disabled || loading}
      onClick={loading ? undefined : onAction}
      className={className}
      {...props}
    >
      {loading && <Spinner className="size-4 mr-2" aria-hidden />}
      {children}
    </Button>
  )
}