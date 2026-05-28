import { Stack } from 'expo-router';
import { useTheme } from '../../../contexts/ThemeContext';

export default function TicketLayout() {
  const { theme } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
