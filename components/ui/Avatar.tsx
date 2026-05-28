import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  imageUrl?: string;
  name?: string;
  size?: AvatarSize;
  bordered?: boolean;
}

export function Avatar({
  imageUrl,
  name,
  size = 'md',
  bordered = false,
}: AvatarProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sizes = {
    sm: 32,
    md: 44,
    lg: 64,
    xl: 96,
  };

  const fontSizes = {
    sm: 14,
    md: 18,
    lg: 26,
    xl: 38,
  };

  const dimension = sizes[size];
  const fontSize = fontSizes[size];

  const getInitials = () => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const containerStyle = [
    styles.container,
    {
      width: dimension,
      height: dimension,
      borderRadius: dimension / 2,
    },
    bordered && styles.bordered,
  ];

  if (imageUrl) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: imageUrl }}
          style={{
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          }}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <LinearGradient
        colors={theme.gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={[styles.initials, { fontSize }]}>
          {getInitials()}
        </Text>
      </LinearGradient>
    </View>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: {
      overflow: 'hidden',
    },
    bordered: {
      borderWidth: 2,
      borderColor: t.colors.borderGlow,
    },
    initials: {
      // Always white — initials render on a dark gradient in every palette
      color: '#ffffff',
      fontWeight: staticTheme.fontWeight.bold,
    },
  });
}
