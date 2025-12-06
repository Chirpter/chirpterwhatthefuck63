
"use client";

import React from 'react';

// This SVG is a manual recreation of the user's provided example,
// optimized for readability and CSS styling.
export const TaskIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 100 80" // Adjusted viewBox for a wider aspect ratio
    {...props}
  >
    {/* Bottom Card - a simple tilted rectangle */}
    <path 
        d="M 0 25 L 85 10 L 100 45 L 15 60 Z"
        className="task-card-back"
    />
    
    {/* Top Card - another path on top */}
    <path 
        d="M 5 15 L 90 0 L 105 35 L 20 50 Z"
        className="task-card-front"
    />
    
    {/* Chip on Top Card */}
    <rect 
      x="20" y="30" width="15" height="10" rx="2"
      transform="rotate(-10 27.5 35)"
      className="task-card-chip"
    />

    {/* Checkmark instead of Star */}
    <path
      d="M72 15 L76 20 L86 10"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="task-star" 
      fill="none"
      stroke="hsl(var(--accent))" 
    />
  </svg>
);
