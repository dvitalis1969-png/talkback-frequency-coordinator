import { useState, useEffect, useRef } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item ? JSON.parse(item) : initialValue;
      if (typeof initialValue === 'object' && initialValue !== null && typeof parsed === 'object' && parsed !== null && !Array.isArray(initialValue)) {
        return { ...initialValue, ...parsed };
      }
      return parsed;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const timer = setTimeout(() => {
      try {
        if (storedValue !== undefined) {
          window.localStorage.setItem(key, JSON.stringify(storedValue));
        } else {
          window.localStorage.removeItem(key);
        }
      } catch (error) {
        console.error(`Error setting localStorage key "${key}":`, error);
      }
    }, 500); // debounce saving to prevent blocking the main thread on every keystroke

    return () => clearTimeout(timer);
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
