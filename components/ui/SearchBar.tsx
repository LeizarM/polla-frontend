import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  value: string;
  onChangeText: (text: string) => void;
}

export function SearchBar({ value, onChangeText, placeholder = 'Buscar...', ...props }: SearchBarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.icon} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        {...props}
      />
    </View>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.inputBg,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 12,
      height: 44,
      paddingHorizontal: staticTheme.spacing.md,
    },
    icon: {
      marginRight: staticTheme.spacing.sm,
    },
    input: {
      flex: 1,
      fontSize: staticTheme.fontSize.md,
      color: t.colors.textPrimary,
    },
  });
}
