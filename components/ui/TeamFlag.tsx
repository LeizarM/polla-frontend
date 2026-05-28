import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Image } from 'expo-image';
import { getFlag, getFlagImageUrl } from '../../utils/flags';
import { resolveMediaUrl } from '../../utils/media';

interface TeamFlagProps {
  team?: { name?: string; country?: string; shield_url?: string | null } | null;
  size?: number;
  showName?: boolean;
}

export function TeamFlag({ team, size = 28, showName = false }: TeamFlagProps) {
  const [imgError, setImgError] = useState(false);
  const shieldUrl = resolveMediaUrl(team?.shield_url);
  const flagCdnUrl = getFlagImageUrl(team?.country, Math.max(80, size * 2));

  const imageUri = shieldUrl || (flagCdnUrl && !imgError ? flagCdnUrl : null);

  if (imageUri && !imgError) {
    return (
      <View style={showName ? styles.row : undefined}>
        <Image
          source={{ uri: imageUri }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: shieldUrl ? size / 2 : size / 5,
            },
          ]}
          contentFit="cover"
          transition={200}
          // Custom shield URLs should always reload so edits propagate across tournaments
          cachePolicy={shieldUrl ? 'none' : 'memory-disk'}
          onError={() => setImgError(true)}
        />
        {showName && (
          <Text style={[styles.name, { fontSize: size * 0.5 }]} numberOfLines={1}>
            {team?.name ?? ''}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={showName ? styles.row : undefined}>
      <Text style={{ fontSize: size * 0.75, lineHeight: size, textAlign: 'center' }}>
        {getFlag(team?.country)}
      </Text>
      {showName && (
        <Text style={[styles.name, { fontSize: size * 0.5 }]} numberOfLines={1}>
          {team?.name ?? ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 80,
  },
});