'use client';

import React from 'react';

interface UngaroLogoProps {
  className?: string;
  color?: string;
}

/**
 * High-fidelity official Emanuel Ungaro wordmark.
 * Uses a clean, bold lowercase sans-serif font stack to match official branding.
 */
export default function UngaroLogo({ className = "h-12", color = "currentColor" }: UngaroLogoProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <span 
        className="font-bold lowercase tracking-[-0.03em] leading-none"
        style={{ 
          color,
          fontSize: 'inherit',
          fontFamily: "'Futura', 'Trebuchet MS', 'Arial Black', sans-serif",
          display: 'block',
          textAlign: 'center'
        }}
      >
        emanuel ungaro
      </span>
    </div>
  );
}
