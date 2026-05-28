import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  onAction?: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
}

export function Header({ title, onBack, onAction, actionIcon }: HeaderProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <LinearGradient
      colors={theme.gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.header}
    >
      <View style={styles.content}>
        {onBack && (
          <Pressable onPress={onBack} style={styles.button}>
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
        )}
        <Text style={styles.title}>{title}</Text>
        {onAction && actionIcon && (
          <Pressable onPress={onAction} style={styles.button}>
            <Ionicons name={actionIcon} size={24} color="#ffffff" />
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    header: {
      paddingTop: 50,
      paddingBottom: staticTheme.spacing.md,
      paddingHorizontal: staticTheme.spacing.md,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: staticTheme.fontSize.xl,
      fontWeight: staticTheme.fontWeight.bold,
      color: '#ffffff',
      flex: 1,
      textAlign: 'center',
    },
    button: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
