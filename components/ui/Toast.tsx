/**
 * Toast — Premium animated toast (inspired by expo-animated-toast)
 *
 * Features:
 *  · Slide-in from top with spring + scale entrance
 *  · Glass surface with left-accent stripe color-coded by type
 *  · Auto-dismiss with bottom progress bar (visualizes remaining time)
 *  · Tap to dismiss immediately
 *  · Stackable: multiple toasts queue up below each other
 *  · Theme-aware (light + dark)
 *  · Same imperative API as before: useToast().showToast(type, message)
 */
import React, {
  createContext, useContext, useState, useCallback, useMemo, useEffect, useRef,
} from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastConfig {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 3200;
let TOAST_ID = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastConfig[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = ++TOAST_ID;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View pointerEvents="box-none" style={styles.container}>
        {toasts.map((t, i) => (
          <ToastItem
            key={t.id}
            toast={t}
            stackIndex={i}
            onDismiss={() => dismissToast(t.id)}
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ─── Single toast item with animations ────────────────────────────────────────

const TYPE_STYLES: Record<ToastType, { accent: string; iconBg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { accent: '#10B981', iconBg: 'rgba(16,185,129,0.18)',  icon: 'checkmark-circle' },
  error:   { accent: '#EF4444', iconBg: 'rgba(239,68,68,0.18)',   icon: 'close-circle' },
  warning: { accent: '#F59E0B', iconBg: 'rgba(245,158,11,0.18)',  icon: 'warning' },
  info:    { accent: '#3B82F6', iconBg: 'rgba(59,130,246,0.18)',  icon: 'information-circle' },
};

interface ToastItemProps {
  toast: ToastConfig;
  stackIndex: number;
  onDismiss: () => void;
}

function ToastItem({ toast, stackIndex, onDismiss }: ToastItemProps) {
  const { theme } = useTheme();
  const itemStyles = useMemo(() => makeItemStyles(theme), [theme]);

  // Entrance / exit animations
  const opacity   = useSharedValue(0);
  const translateY = useSharedValue(-30);
  const scale     = useSharedValue(0.92);
  const progress  = useSharedValue(1);
  const dismissed = useRef(false);

  const handleDismiss = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    opacity.value    = withTiming(0, { duration: 200 });
    translateY.value = withTiming(-20, { duration: 220, easing: Easing.in(Easing.cubic) });
    scale.value      = withTiming(0.94, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onDismiss)();
    });
  }, [onDismiss, opacity, translateY, scale]);

  // Mount: animate in + start auto-dismiss timer
  useEffect(() => {
    opacity.value    = withTiming(1, { duration: 220 });
    translateY.value = withSpring(0, { damping: 16, stiffness: 200, mass: 0.7 });
    scale.value     = withSpring(1, { damping: 18, stiffness: 220, mass: 0.6 });
    progress.value   = withTiming(0, { duration: DEFAULT_DURATION, easing: Easing.linear });
    const t = setTimeout(handleDismiss, DEFAULT_DURATION);
    return () => clearTimeout(t);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [0, 100], Extrapolate.CLAMP)}%`,
  }));

  const cfg = TYPE_STYLES[toast.type];

  return (
    <Animated.View
      style={[
        itemStyles.toastWrap,
        // Stack offset — each subsequent toast pushed down a bit
        { marginTop: stackIndex === 0 ? 0 : 8 },
        containerStyle,
      ]}
    >
      <Pressable onPress={handleDismiss} style={itemStyles.pressable}>
        <View style={[itemStyles.toast, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Left accent stripe */}
          <View style={[itemStyles.accentStripe, { backgroundColor: cfg.accent }]} />

          {/* Icon */}
          <View style={[itemStyles.iconBubble, { backgroundColor: cfg.iconBg }]}>
            <Ionicons name={cfg.icon} size={20} color={cfg.accent} />
          </View>

          {/* Message */}
          <Text style={[itemStyles.message, { color: theme.colors.textPrimary }]} numberOfLines={3}>
            {toast.message}
          </Text>

          {/* Close affordance */}
          <Ionicons name="close" size={16} color={theme.colors.textMuted} style={itemStyles.closeIcon} />

          {/* Progress bar (auto-dismiss countdown) */}
          <View style={[itemStyles.progressTrack, { backgroundColor: theme.colors.border }]}>
            <Animated.View style={[itemStyles.progressFill, { backgroundColor: cfg.accent }, progressStyle]} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 16 : 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: 16,
  },
});

function makeItemStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    toastWrap: {
      width: '100%',
      maxWidth: 480,
    },
    pressable: {
      width: '100%',
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingLeft: 14,
      paddingRight: 12,
      borderRadius: 14,
      borderWidth: 1,
      overflow: 'hidden',
      // Premium glass shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 12,
      position: 'relative',
    },
    accentStripe: {
      position: 'absolute',
      left: 0, top: 0, bottom: 0,
      width: 4,
      borderTopLeftRadius: 14,
      borderBottomLeftRadius: 14,
    },
    iconBubble: {
      width: 34, height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    message: {
      flex: 1,
      fontSize: 13,
      fontFamily: 'Poppins_500Medium',
      lineHeight: 17,
    },
    closeIcon: {
      marginLeft: 4,
      opacity: 0.6,
    },
    progressTrack: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      height: 2,
      opacity: 0.3,
    },
    progressFill: {
      position: 'absolute',
      left: 0, top: 0, bottom: 0,
    },
  });
}
