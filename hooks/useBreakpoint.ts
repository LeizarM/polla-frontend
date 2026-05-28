import { useWindowDimensions } from 'react-native';

export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const DESKTOP_BREAKPOINT = 768;

export function useBreakpoint() {
  const { width } = useWindowDimensions();
  return {
    isDesktop: width >= DESKTOP_BREAKPOINT,
    width,
  };
}
