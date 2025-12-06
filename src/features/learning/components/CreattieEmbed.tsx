
"use client";

import React, { useEffect } from 'react';

// Define the custom element type for TypeScript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'creattie-embed': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        delay?: string;
        speed?: string;
        frame_rate?: string;
        trigger?: string;
      };
    }
  }
}

const SCRIPT_ID = 'creattie-embed-script';
const SCRIPT_SRC = 'https://creattie.com/js/embed.js?id=3f6954fde297cd31b441';

interface CreattieEmbedProps {
  src: string;
}

const CreattieEmbed: React.FC<CreattieEmbedProps> = ({ src }) => {
  useEffect(() => {
    // Check if the script has already been added to the page
    if (document.getElementById(SCRIPT_ID)) {
      return;
    }

    // Create the script element
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.defer = true;
    
    // Append the script to the body
    document.body.appendChild(script);

    // Clean up the script when the component unmounts
    return () => {
      const existingScript = document.getElementById(SCRIPT_ID);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <creattie-embed
        src={src}
        delay="1"
        speed="100"
        frame_rate="24"
        trigger="loop"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default CreattieEmbed;
