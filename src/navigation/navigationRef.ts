import { createNavigationContainerRef } from '@react-navigation/native';

// English-only comments
export const navigationRef = createNavigationContainerRef<any>();

export function getCurrentRouteSnapshot(): { name: string; params?: any } | null {
  if (!navigationRef.isReady()) return null;
  const r = navigationRef.getCurrentRoute();
  if (!r) return null;
  return { name: r.name, params: r.params ?? undefined };
}


