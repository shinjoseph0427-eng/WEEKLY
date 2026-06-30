// Tab shell — five tabs mapped from web BottomNav.jsx:
// Home (index), Explore, Drop (the weekly card — core), Inbox, Me.
import { Tabs } from 'expo-router';
import { CalendarPlus, Compass, Home, Inbox, User } from 'lucide-react-native';
import { C } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.orange,
        tabBarInactiveTintColor: C.textMuted,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: C.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Explore', tabBarIcon: ({ color, size }) => <Compass color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="drop"
        options={{ title: 'Drop', tabBarIcon: ({ color, size }) => <CalendarPlus color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="inbox"
        options={{ title: 'Inbox', tabBarIcon: ({ color, size }) => <Inbox color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: 'Me', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tabs>
  );
}
