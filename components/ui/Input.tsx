/**
 * Input — Premium NativeWind + Reanimated
 * Floating label · focus glow · error shake · password toggle · icon support
 */
import React, { useState, useRef, useEffect, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  Pressable,
  TextInputProps,
  KeyboardTypeOptions,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';

type InputType = 'text' | 'password' | 'phone' | 'number';

interface InputProps extends Omit<TextInputProps, 'secureTextEntry' | 'keyboardType'> {
  label?: string;
  error?: string;
  hint?: string;
  type?: InputType;
  icon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<TextInput, InputProps>(function Input({
  label,
  error,
  hint,
  type = 'text',
  value,
  onChangeText,
  placeholder,
  icon,
  rightElement,
  ...props
}: InputProps, ref) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Shared values
  const focusProgress  = useSharedValue(0); // 0 = blur, 1 = focus
  const errorProgress  = useSharedValue(0);
  const labelFloat     = useSharedValue(0); // 0 = resting, 1 = floated
  const shakeOffset    = useSharedValue(0);

  const hasContent = !!value;
  const floated    = hasContent || isFocused;

  useEffect(() => {
    labelFloat.value = withTiming(floated ? 1 : 0, {
      duration: 180,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [floated]);

  useEffect(() => {
    errorProgress.value = withTiming(error ? 1 : 0, { duration: 200 });
    if (error) {
      shakeOffset.value = withSequence(
        withTiming(-7, { duration: 45 }),
        withTiming(7,  { duration: 45 }),
        withTiming(-5, { duration: 45 }),
        withTiming(5,  { duration: 45 }),
        withTiming(0,  { duration: 40 }),
      );
    }
  }, [error]);

  const handleFocus = () => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 180 });
  };
  const handleBlur = () => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 180 });
  };

  // Animated border container
  const containerAnim = useAnimatedStyle(() => {
    const borderCol = error
      ? theme.colors.error
      : interpolateColor(focusProgress.value, [0, 1], [theme.colors.border, theme.colors.borderGlow]);
    return {
      borderColor: borderCol,
      borderWidth: focusProgress.value > 0.5 ? 1.5 : 1,
      transform: [{ translateX: shakeOffset.value }],
      shadowColor: error ? theme.colors.error : theme.colors.borderGlow,
      shadowOpacity: focusProgress.value * 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  // Floating label animation
  const labelAnim = useAnimatedStyle(() => ({
    transform: [
      { translateY: withTiming(labelFloat.value === 1 ? -22 : 0, { duration: 0 }) },
      { scale:      labelFloat.value === 1 ? 0.82 : 1 },
    ],
    // We drive this via direct shared value, not interpolation
    translateY: labelFloat.value * -22,
  }));

  // Simpler approach — compute directly
  const computedLabelStyle = {
    transform: [
      { translateY: floated ? -22 : 0 },
      { scale: floated ? 0.82 : 1 },
    ] as any,
    color: error
      ? theme.colors.error
      : isFocused
      ? theme.colors.primaryLight
      : theme.colors.textMuted,
    fontSize: floated ? 11 : 14,
  };

  const getKeyboardType = (): KeyboardTypeOptions => {
    if (type === 'phone')  return 'phone-pad';
    if (type === 'number') return 'numeric';
    return 'default';
  };

  const iconColor = isFocused ? theme.colors.primaryLight : theme.colors.textMuted;

  return (
    <View className="mb-md">
      <Animated.View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.inputBg,
            borderRadius: 12,
            paddingHorizontal: 14,
            minHeight: 56,
            elevation: Platform.OS === 'android' ? (isFocused ? 4 : 1) : 0,
          },
          containerAnim,
        ]}
      >
        {/* Left icon */}
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={iconColor}
            style={{ marginRight: 10, flexShrink: 0 }}
          />
        )}

        {/* Label + TextInput wrapper */}
        <View style={{ flex: 1, justifyContent: 'center', paddingTop: label ? 10 : 0 }}>
          {label && (
            <Text
              style={[
                {
                  position: 'absolute',
                  fontFamily: 'Poppins_500Medium',
                  paddingHorizontal: 2,
                  letterSpacing: 0.1,
                  // Transition via React Native Animated isn't straightforward
                  // We use direct style computation for simplicity + correctness
                },
                computedLabelStyle,
              ]}
              numberOfLines={1}
              pointerEvents="none"
            >
              {label}
            </Text>
          )}
          <TextInput
            ref={ref ?? inputRef}
            style={{
              fontSize: 14,
              fontFamily: 'Poppins_400Regular',
              color: theme.colors.textPrimary,
              paddingVertical: label ? 4 : 10,
              minHeight: 36,
            }}
            value={value}
            onChangeText={onChangeText}
            placeholder={(!label || floated) ? placeholder : undefined}
            placeholderTextColor={theme.colors.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={type === 'password' && !showPassword}
            keyboardType={getKeyboardType()}
            autoCapitalize={type === 'password' ? 'none' : props.autoCapitalize}
            {...props}
          />
        </View>

        {/* Right: password toggle or custom element */}
        {type === 'password' && (
          <Pressable
            onPress={() => setShowPassword(v => !v)}
            hitSlop={8}
            style={{ padding: 6, marginLeft: 4 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={theme.colors.textMuted}
            />
          </Pressable>
        )}
        {rightElement && !type.includes('password') && (
          <View style={{ marginLeft: 6 }}>{rightElement}</View>
        )}
      </Animated.View>

      {/* Error message */}
      {error ? (
        <View className="flex-row items-center mt-xs ml-sm gap-[4px]">
          <Ionicons name="alert-circle" size={13} color={theme.colors.error} />
          <Text style={{ color: theme.colors.error, fontSize: 11, fontFamily: 'Poppins_400Regular' }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text
          className="mt-xs ml-sm"
          style={{ color: theme.colors.textMuted, fontSize: 11, fontFamily: 'Poppins_400Regular' }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
});
