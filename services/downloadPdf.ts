import { Platform, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from '../constants/api';
import { secureStore } from './secureStorage';

/**
 * Downloads a PDF report.
 * Web: fetch blob and trigger download via <a> tag.
 * Mobile: fetch blob, write to file, then share.
 */
export async function downloadPdf(path: string, filename: string) {
  try {
    const baseUrl = (API_BASE_URL ?? '').replace(/\/$/, '');
    const token = await secureStore.get('token');
    const authHeader = token ? `Bearer ${token}` : '';
    const fullUrl = `${baseUrl}${path}`;

    if (Platform.OS === 'web') {
      const response = await fetch(fullUrl, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // Mobile: use fetch + expo-file-system File API
      const response = await fetch(fullUrl, {
        headers: { 'Authorization': authHeader },
      });
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
      const blob = await response.blob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data:application/pdf;base64, prefix
          const base64 = result?.split(',')[1] ?? '';
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Error leyendo PDF'));
        reader.readAsDataURL(blob);
      });

      // Write using expo-file-system legacy API
      const FileSystem = await import('expo-file-system/legacy');
      const fileUri = `${FileSystem.cacheDirectory ?? ''}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: filename,
        });
      } else {
        Alert.alert('Descargado', `PDF guardado: ${filename}`);
      }
    }
  } catch (error: any) {
    console.error('downloadPdf error:', error);
    throw new Error(error?.message ?? 'Error al descargar PDF');
  }
}