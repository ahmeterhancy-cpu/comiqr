import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth';
import { waiterApi } from '@/api/waiter';
import { ApiError } from '@/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const session = await waiterApi.login(email.trim(), password);
      if (session.user.role !== 'waiter' && session.user.role !== 'cashier' && session.user.role !== 'manager') {
        setError('Bu hesabın garson erişimi yok.');
        return;
      }
      await login(session);
      router.replace('/board');
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 0 ? 'E-posta veya parola hatalı.' : 'Bağlantı kurulamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-10" keyboardShouldPersistTaps="handled">
          <View className="rounded-3xl bg-white p-7 shadow-xl">
            <View className="mb-7 items-center">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl bg-brand-500">
                <Text className="text-2xl">🍽️</Text>
              </View>
              <Text className="text-xl font-extrabold text-slate-900">Garson Girişi</Text>
              <Text className="mt-1 text-xs text-slate-500">Hesabınla giriş yap, kat planına git.</Text>
            </View>

            {error ? (
              <View className="mb-4 rounded-xl bg-red-50 px-3 py-2.5">
                <Text className="text-sm text-red-700">{error}</Text>
              </View>
            ) : null}

            <Text className="mb-1.5 text-xs font-semibold text-slate-600">E-posta</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              placeholder="ornek@comiqr.com"
              placeholderTextColor="#94a3b8"
              className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900"
            />

            <Text className="mb-1.5 text-xs font-semibold text-slate-600">Parola</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              onSubmitEditing={onSubmit}
              className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900"
            />

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              className="items-center rounded-xl bg-brand-500 py-4 active:opacity-90"
              style={{ opacity: loading ? 0.6 : 1 }}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-base font-bold text-white">Giriş yap</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
