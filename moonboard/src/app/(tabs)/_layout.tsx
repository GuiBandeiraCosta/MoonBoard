import { Redirect, Tabs } from 'expo-router';
import { Bluetooth, BookMarked, Mountain, Settings2 } from 'lucide-react-native';
import React from 'react';
import { Loading } from '@/components/ui';
import { useSettings } from '@/lib/settings/store';
import { useTheme } from '@/lib/theme';
import { useBoard } from '@/lib/ble/useBoard';

export default function TabLayout() {
  const { colors } = useTheme();
  const settings = useSettings();
  const board = useBoard();

  if (!settings.loaded) return <Loading />;
  if (settings.layoutId == null) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Problems',
          tabBarIcon: ({ color, size }) => <Mountain color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="logbook"
        options={{
          title: 'Logbook',
          tabBarIcon: ({ color, size }) => <BookMarked color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          tabBarIcon: ({ color, size }) => <Bluetooth color={board.isConnected ? colors.success : color} size={size} strokeWidth={2} />,
          tabBarBadge: board.isConnected ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.success, minWidth: 8, height: 8, borderRadius: 4, top: 4 },
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings2 color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}
