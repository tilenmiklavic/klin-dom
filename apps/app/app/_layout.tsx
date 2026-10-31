import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
// Per-weight entry points: the package barrel would bundle every Geist weight and italic.
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@klindom/ui';
import '../src/i18n';
import { AuthGate } from '../src/auth/AuthGate';
import { AuthProvider } from '../src/auth/AuthProvider';
import { createQueryClient, subscribeAppFocus } from '../src/data/queryClient';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold });
  const [queryClient] = useState(createQueryClient);
  useEffect(subscribeAppFocus, []);

  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="task-editor" options={{ presentation: 'modal' }} />
              </Stack>
            </AuthGate>
            <StatusBar style="dark" />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
