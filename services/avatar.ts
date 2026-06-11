import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import api from './api';
import { API_BASE_URL } from '../constants/api';

/** URL pública del avatar de un usuario (para <Image>). null si no hay userId. */
export function avatarUri(userId?: string | null, version?: string | number): string | null {
  if (!userId) return null;
  const base = (API_BASE_URL ?? '').replace(/\/$/, '');
  return `${base}/api/users/${userId}/avatar${version ? `?v=${version}` : ''}`;
}

// Redimensiona una imagen (data:/blob: URL) a un cuadrado `size` JPEG vía canvas.
// SOLO web. Evita subir fotos enormes (el backend rechaza >500KB).
function resizeWeb(uri: string, size: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(uri);
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2, sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(uri);
      img.src = uri;
    } catch { resolve(uri); }
  });
}

/** Pide permiso, abre el picker, comprime y sube. Devuelve { avatar_url } o null
 *  si el usuario canceló. Lanza Error con mensaje claro si falla. */
export async function pickAndUploadAvatar(): Promise<{ avatar_url: string } | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Necesitamos permiso para acceder a tus fotos');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.5,
    base64: Platform.OS !== 'web',
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  // Web: redimensionamos con canvas a 256px (asset.uri es blob:/data:).
  // Native: armamos data URI con el base64 (el crop + quality ya lo achican).
  const dataUri = Platform.OS === 'web'
    ? await resizeWeb(asset.uri, 256, 0.7)
    : `data:image/jpeg;base64,${asset.base64 ?? ''}`;

  const res = await api.post('/api/users/me/avatar', { image: dataUri });
  return res?.data ?? null;
}
