
"use client";

import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    const handleResize = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    // Set the initial state
    setIsMobile(mql.matches);

    // Add the event listener
    mql.addEventListener('change', handleResize);

    // Remove the event listener on cleanup
    return () => {
      mql.removeEventListener('change', handleResize);
    };
  }, []);

  return isMobile
}
