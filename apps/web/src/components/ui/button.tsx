import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const base =
  'inline-flex h-11 items-center justify-center gap-2 rounded-button px-5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-primary bg-card text-primary hover:bg-background',
  ghost: 'text-primary hover:bg-primary/5',
};

/** Class names for buttons; also usable on <Link> so links look like buttons. */
export function buttonClasses(variant: Variant = 'primary', extra = ''): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
