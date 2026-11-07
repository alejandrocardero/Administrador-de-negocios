import { useEffect, useRef, useState } from 'react';

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

/**
 * Hook para detectar cuando un elemento entra en el viewport
 * usando IntersectionObserver.
 */
export function useScrollAnimation(options: UseScrollAnimationOptions = {}) {
  const { threshold = 0.1, rootMargin = '0px', triggerOnce = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Respeta prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (triggerOnce && elementRef.current) {
            observer.unobserve(elementRef.current);
          }
        } else if (!triggerOnce) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, triggerOnce]);

  return { ref: elementRef, isVisible };
}

/**
 * Variante que retorna solo la ref y maneja múltiples elementos
 */
export function useScrollAnimations(count: number, options: UseScrollAnimationOptions = {}) {
  const refs = useRef<(HTMLElement | null)[]>(new Array(count).fill(null));
  const [visible, setVisible] = useState<boolean[]>(new Array(count).fill(false));

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setVisible(new Array(count).fill(true));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const index = refs.current.indexOf(entry.target as HTMLElement);
          if (index !== -1) {
            setVisible((prev) => {
              const next = [...prev];
              next[index] = entry.isIntersecting;
              return next;
            });
            if (options.triggerOnce && entry.isIntersecting) {
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: options.threshold ?? 0.1, rootMargin: options.rootMargin ?? '0px' }
    );

    refs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [count, options.threshold, options.rootMargin, options.triggerOnce]);

  const setRef = (index: number) => (el: HTMLElement | null) => {
    refs.current[index] = el;
  };

  return { refs: setRef, visible };
}