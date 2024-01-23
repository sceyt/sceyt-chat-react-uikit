import { useState, useEffect } from 'react';

function useMobileView(breakpoint = 768) {
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < breakpoint);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < breakpoint);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return isMobileView;
}

export default useMobileView
