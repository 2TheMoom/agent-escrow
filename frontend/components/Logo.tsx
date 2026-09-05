/**
 * AgentEscrow Logo Component
 *
 * "Bonded Seal" mark: a postmark-style ring with radiating ticks and a
 * checkmark, evoking a customs/notary stamp of clearance - distinct from
 * GenLayer's own triangular mark.
 *
 * Variants:
 * - "full": Mark + Wordmark (for desktop/larger spaces)
 * - "mark": Mark only (for mobile/compact spaces)
 * - "wordmark": Wordmark only
 */

import React from 'react';

export type LogoVariant = 'full' | 'mark' | 'wordmark';
export type LogoSize = 'sm' | 'md' | 'lg';
export type LogoTheme = 'light' | 'dark';

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  theme?: LogoTheme;
  className?: string;
}

const sizeMap = {
  sm: { mark: 'w-5 h-5', text: 'text-base' },
  md: { mark: 'w-7 h-7', text: 'text-xl' },
  lg: { mark: 'w-9 h-9', text: 'text-2xl' },
};

const TICK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function Logo({
  variant = 'full',
  size = 'md',
  theme = 'dark',
  className = '',
}: LogoProps) {
  const colorClass = theme === 'dark' ? 'text-foreground' : 'text-background';
  const { mark: markSize, text: textSize } = sizeMap[size];

  const SealMark = () => (
    <svg
      className={`${markSize} text-primary transition-colors`}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AgentEscrow Logo"
    >
      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g stroke="currentColor" strokeWidth="2">
        {TICK_ANGLES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 50 + 39 * Math.cos(rad);
          const y1 = 50 + 39 * Math.sin(rad);
          const x2 = 50 + 45.5 * Math.cos(rad);
          const y2 = 50 + 45.5 * Math.sin(rad);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} />;
        })}
      </g>
      <path
        d="M32 51 L44 63 L69 35"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const Wordmark = () => (
    <span
      className={`${textSize} font-bold ${colorClass} font-[family-name:var(--font-display)] transition-colors`}
      style={{ letterSpacing: '-0.01em' }}
    >
      AgentEscrow
    </span>
  );

  if (variant === 'mark') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <SealMark />
      </div>
    );
  }

  if (variant === 'wordmark') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <Wordmark />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <SealMark />
      <Wordmark />
    </div>
  );
}

export function LogoFull(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="full" />;
}

export function LogoMark(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="mark" />;
}

export function LogoWordmark(props: Omit<LogoProps, 'variant'>) {
  return <Logo {...props} variant="wordmark" />;
}
