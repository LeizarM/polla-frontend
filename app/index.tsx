import { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../contexts/ThemeContext';
import { theme as staticTheme } from '../constants/theme';

export default function Index() {
  const { user, isAdmin } = useAuthStore();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  useEffect(() => {
    if (user) {
      if (isAdmin()) {
        router.replace('/admin');
      } else {
        router.replace('/user');
      }
    } else {
      router.replace('/auth/login');
    }
  }, [user]);

  return <View style={styles.container} />;
}

function makeStyles(t: typeof staticTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
  });
}
