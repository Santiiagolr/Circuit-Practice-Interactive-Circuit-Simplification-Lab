import { useSyncExternalStore } from 'react';

const queryText = '(prefers-reduced-motion: reduce)';
const subscribe = callback => {
  const query = window.matchMedia?.(queryText);
  query?.addEventListener?.('change', callback);
  return () => query?.removeEventListener?.('change', callback);
};
const snapshot = () => typeof window !== 'undefined' && window.matchMedia?.(queryText).matches === true;
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
