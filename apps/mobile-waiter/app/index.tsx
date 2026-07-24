import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth';

/** Entry gate — go to the board when signed in, otherwise the login screen. */
export default function Index() {
  const token = useAuthStore((s) => s.token);
  return <Redirect href={token ? '/board' : '/login'} />;
}
