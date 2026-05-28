import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTheme } from '../../contexts/ThemeContext';
import { theme as staticTheme } from '../../constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmDialogProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Modal visible={visible} onClose={onCancel}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.buttons}>
          <View style={styles.button}>
            <Button
              title={cancelLabel}
              onPress={onCancel}
              variant="outline"
              disabled={loading}
            />
          </View>
          <View style={styles.button}>
            <Button
              title={confirmLabel}
              onPress={onConfirm}
              loading={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    title: {
      fontSize: staticTheme.fontSize.xl,
      fontWeight: staticTheme.fontWeight.bold,
      color: t.colors.textPrimary,
      marginBottom: staticTheme.spacing.md,
    },
    message: {
      fontSize: staticTheme.fontSize.md,
      color: t.colors.textSecondary,
      marginBottom: staticTheme.spacing.lg,
    },
    buttons: {
      flexDirection: 'row',
      gap: staticTheme.spacing.md,
    },
    button: {
      flex: 1,
    },
  });
}
