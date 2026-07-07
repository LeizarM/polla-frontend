/**
 * Modal — Premium glass overlay
 * Reanimated entrance (scale + translateY) · gradient top border
 * Backdrop tap-to-close · keyboard-aware · optional persistent mode
 */
import React, { useEffect } from 'react';
import {
  View,
  Modal as RNModal,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Disable close-on-backdrop-tap (e.g. during loading) */
  persistent?: boolean;
  /** Override card max-height (default '85%') */
  maxHeight?: string | number;
  /** Contenido fijo abajo (botón de acción). Queda SIEMPRE visible: no scrollea
   *  con el cuerpo. Evita que el CTA quede fuera de pantalla en móvil. */
  footer?: React.ReactNode;
}

export function Modal({
  visible,
  onClose,
  children,
  persistent = false,
  maxHeight = '85%',
  footer,
}: ModalProps) {
  const { theme } = useTheme();

  const backdropOpacity = useSharedValue(0);
  const cardScale       = useSharedValue(0.93);
  const cardTranslateY  = useSharedValue(22);
  const cardOpacity     = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
      cardOpacity.value     = withTiming(1, { duration: 200 });
      cardScale.value       = withSpring(1,  { damping: 18, stiffness: 190, mass: 0.85 });
      cardTranslateY.value  = withSpring(0,  { damping: 18, stiffness: 190, mass: 0.85 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      cardOpacity.value     = withTiming(0, { duration: 160 });
      cardScale.value       = withTiming(0.93, { duration: 180 });
      cardTranslateY.value  = withTiming(18,   { duration: 180 });
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale:      cardScale.value      },
      { translateY: cardTranslateY.value },
    ],
  }));

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.root}
      >
        {/* Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          {!persistent && (
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          )}
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            {
              maxHeight: maxHeight as any,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 24 },
              shadowOpacity: 0.65,
              shadowRadius: 44,
              elevation: 26,
            },
            cardStyle,
          ]}
        >
          {/* Gradient top border */}
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryLight, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topLine}
          />

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {children}
          </ScrollView>

          {/* Footer fijo (CTA) — fuera del scroll, siempre visible */}
          {footer ? (
            <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  topLine: {
    height: 1.5,
  },
  // flexShrink permite que el ScrollView se achique cuando el contenido supera
  // el maxHeight del card, dejando el footer fijo visible (y arreglando el scroll
  // en web, donde sin esto el contenido desbordaba y el card lo recortaba).
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    // Sombra hacia arriba → la barra de acción se despega del contenido que
    // scrollea, para que el CTA se note claramente (sobre todo en el APK).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 16,
  },
});
