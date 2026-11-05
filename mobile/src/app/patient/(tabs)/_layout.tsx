import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { colors } from '@/lib/theme';

export default function PatientTabs() {
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
        options={{ title: 'My visits', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="book"
        options={{ title: 'Book a visit', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size} color={color as string} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color as string} /> }}
      />
    </Tabs>
  );
}
