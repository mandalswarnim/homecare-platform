import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { colors } from '@/lib/theme';

export default function ClinicianTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.surface },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Visits', tabBarIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color as string} /> }}
      />
    </Tabs>
  );
}
