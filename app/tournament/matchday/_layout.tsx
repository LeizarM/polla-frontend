import { Stack } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';

export default function MatchdayLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
      }}
    />
  );
}
