import { forwardRef, type ReactNode, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { useScrollAnimation, useScrollAnimations } from '@/hooks/useScrollAnimation';

interface ScrollRevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Retraso en ms antes de iniciar la animación */
  delay?: number;
  /** Duración de la animación en ms */
  duration?: number;
  /** Dirección de entrada */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Solo animar una vez */
  once?: boolean;
  /** Margen extra para el trigger (ej: '0px 0px -50px 0px') */
  rootMargin?: string;
  /** Umbral de visibilidad (0-1) */
  threshold?: number;
}

/**
 * Componente que revela su contenido con animación al hacer scroll.
 * Respeta prefers-reduced-motion.
 */
export const ScrollReveal = forwardRef<HTMLDivElement, ScrollRevealProps>(
  (
    {
      children,
      delay = 0,
      duration = 500,
      direction = 'up',
      once = true,
      rootMargin = '0px 0px -50px 0px',
      threshold = 0.1,
      className,
      style,
      ...props
    },
    ref
  ) => {
    const { ref: elementRef, isVisible } = useScrollAnimation({
      threshold,
      rootMargin,
      triggerOnce: once,
    });

    const directionClasses = {
      up: 'translate-y-4',
      down: '-translate-y-4',
      left: 'translate-x-4',
      right: '-translate-x-4',
    };

    const combinedRef = (el: HTMLDivElement | null) => {
      elementRef.current = el;
      if (ref) {
        if (typeof ref === 'function') ref(el);
        else ref.current = el;
      }
    };

    return (
      <div
        ref={combinedRef}
        className={cn(
          'transition-all ease-out',
          isVisible
            ? 'opacity-100 translate-x-0 translate-y-0'
            : `opacity-0 ${directionClasses[direction]}`,
          className
        )}
        style={{
          ...style,
          transitionDuration: `${duration}ms`,
          transitionDelay: `${delay}ms`,
        } as React.CSSProperties}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollReveal.displayName = 'ScrollReveal';

/**
 * Variante para listas: anima cada hijo con stagger
 */
interface ScrollRevealListProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Delay base entre cada item (ms) */
  itemDelay?: number;
  /** Duración de cada animación */
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
}

export function ScrollRevealList({
  children,
  itemDelay = 100,
  duration = 500,
  direction = 'up',
  once = true,
  rootMargin = '0px 0px -50px 0px',
  threshold = 0.1,
  className,
  ...props
}: ScrollRevealListProps) {
  const childArray = Array.isArray(children) ? children : [children];
  const { refs, visible } = useScrollAnimations(childArray.length, {
    threshold,
    rootMargin,
    triggerOnce: once,
  });

  const directionClasses = {
    up: 'translate-y-4',
    down: '-translate-y-4',
    left: 'translate-x-4',
    right: '-translate-x-4',
  };

  return (
    <div className={cn('space-y-4', className)} {...props}>
      {childArray.map((child, index) => (
        <div
          key={index}
          ref={refs(index)}
          className={cn(
            'transition-all ease-out',
            visible[index]
              ? 'opacity-100 translate-x-0 translate-y-0'
              : `opacity-0 ${directionClasses[direction]}`,
            (child.props as any)?.className
          )}
          style={{
            ...(child.props as any)?.style,
            transitionDuration: `${duration}ms`,
            transitionDelay: `${index * itemDelay}ms`,
          } as React.CSSProperties}
        >
          {child}
        </div>
      ))}
    </div>
  );
}