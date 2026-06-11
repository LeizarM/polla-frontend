import React, { useState } from 'react';
import { View, Text, Image, ViewStyle, TextStyle } from 'react-native';
import { avatarUri } from '../../services/avatar';

interface Props {
  userId?: string | null;
  name?: string | null;
  size?: number;
  /** Si se pasa, el fallback (sin foto) es el emoji — ej. La Carrera del Torneo.
   *  Si no, el fallback son las iniciales del nombre. */
  fallbackEmoji?: string;
  /** Cache-bust: cambialo (ej. avatar_updated_at) para forzar recarga al cambiar foto. */
  version?: string | number;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const ini = parts.map((w) => w[0]?.toUpperCase() ?? '').join('');
  return ini || '?';
}

/** Muestra la foto de perfil del usuario (GET /api/users/:id/avatar). Si el
 *  usuario no tiene foto (404) o falla la carga, cae al fallback: emoji (si se
 *  pasó fallbackEmoji) o las iniciales del nombre. */
export function UserAvatar({ userId, name, size = 40, fallbackEmoji, version, style, textStyle }: Props) {
  const [failed, setFailed] = useState(false);
  const uri = avatarUri(userId, version);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.10)' }, style as any]}
      />
    );
  }
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)' }, style as any]}>
      <Text style={[{ fontSize: fallbackEmoji ? size * 0.62 : size * 0.4, color: '#fff', fontFamily: 'Poppins_700Bold' }, textStyle as any]}>
        {fallbackEmoji ?? initialsOf(name)}
      </Text>
    </View>
  );
}
