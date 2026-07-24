import '../global.css';
import { useEffect } from 'react';
import { Text, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth';
import { setOnUnauthorized } from '@/api/client';

// Keep the layout stable regardless of the device's system font scaling.
if ((Text as any).defaultProps == null) (Text as any).defaultProps = {};
(Text as any).defaultProps.allowFontScaling = false;
if ((TextInput as any).defaultProps == null) (TextInput as any).defaultProps = {};
(TextInput as any).defaultProps.allowFontScaling = false;

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // An expired/invalid token (401) logs the waiter out and returns to login.
  useEffect(() => {
    setOnUnauthorized(async () => {
      await logout();
      router.replace('/login');
    });
  }, [logout, router]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#f8fafc' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="board" />
          <Stack.Screen name="order" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
