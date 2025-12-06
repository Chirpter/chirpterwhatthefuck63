
"use client";

import React from 'react';

// This SVG is derived from the user's provided code, but adapted for React and CSS styling.
// The fill colors have been removed and replaced with CSS classes for dynamic theming.
export const SuperBadgeTrophy = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      id="primary"
      d="M16.6 2.2a1 1 0 0 0-1-.14l-8 3a1 1 0 0 0-.65 1l1 11A1 1 0 0 0 9 18h6a1 1 0 0 0 1-.93l1-14A1 1 0 0 0 16.6 2.2Z"
      className="trophy-cup"
    />
    <path
      id="secondary"
      d="M16 17H8a2 2 0 0 0-2 2v2a1 1 0 0 0 1 1H17a1 1 0 0 0 1-1V19a2 2 0 0 0-2-2Z"
      className="trophy-base"
    />
  </svg>
);
