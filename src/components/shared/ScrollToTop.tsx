import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * Botón "Volver arriba" que aparece tras hacer scroll.
 * Smooth scroll al top al hacer click.
 */
export function ScrollToTop({
  threshold = 400,
  className,
  ...props
}: {
  threshold?: number;
  className?: string;
} & React.ComponentPropsWithoutRef<typeof Button>) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      setVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!mounted || !visible) return null;

  return (
    <Button
      type="button"
      variant="default"
      size="icon"
      onClick={scrollToTop}
      aria-label="Volver arriba"
      className={cn(
        'fixed bottom-6 right-6 z-50 shadow-lg rounded-full',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'animate-in fade-in zoom-in-95 duration-200 ease-out',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        className
      )}
      data-state={visible ? 'open' : 'closed'}
      {...props}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </Button>
  );
}