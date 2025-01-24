import { useEffect, useRef, useCallback } from 'react';

// PUBLIC_INTERFACE
/**
 * Custom hook to track component mount state
 * @returns {Function} Function that returns whether the component is mounted
 */
export const useMountedState = () => {
  const mountedRef = useRef(false);
  
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  return useCallback(() => mountedRef.current, []);
};