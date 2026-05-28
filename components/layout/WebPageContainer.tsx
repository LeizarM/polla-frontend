import React from 'react';
import { View, Platform, useWindowDimensions } from 'react-native';
import { DESKTOP_BREAKPOINT } from '../../hooks/useBreakpoint';

interface Props {
  children: React.ReactNode;
  maxWidth?: number;
}

/**
 * On desktop web: centers content with a max-width.
 * On mobile: renders children as-is (no wrapper overhead).
 */
export function WebPageContainer({ children, maxWidth = 1100 }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  if (!isDesktop) return <>{children}</>;

  return (
    <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#0D1B2E' }}>
      <View style={{ flex: 1, width: '100%', maxWidth }}>
        {children}
      </View>
    </View>
  );
}
