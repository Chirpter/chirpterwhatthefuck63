
"use client";

import React from 'react';

// This component is now a static SVG.
// All animations have been removed for simplicity and consistency.
export const MissionIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 80"
    {...props}
  >
    <g>
        {/* Bottom Card */}
        <path 
            d="M 0 25 L 85 10 L 100 45 L 15 60 Z"
            className="mission-card-back"
        />
        {/* Top Card */}
        <path 
            d="M 5 15 L 90 0 L 105 35 L 20 50 Z"
            className="mission-card-front"
        />
        {/* Chip on Top Card */}
        <rect 
          x="20" y="30" width="15" height="10" rx="2"
          transform="rotate(-10 27.5 35)"
          className="mission-card-chip"
        />
    </g>
    
    {/* Checkmark/Star */}
    <path
      d="M72 15 L76 20 L86 10"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mission-star" 
      fill="none"
      stroke="hsl(var(--accent))"
    />
  </svg>
);
