import { useEffect } from 'react';
import { Text, View, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { completeOAuthCallback } from '../lib/hooks/useAuth';
import { getAuthSnapshot } from '../lib/hooks/useCurrentUser';
import { showToast } from '../components/shared/Toast';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const handleCallback = async () => {
      try {
        // OAuth is completed here exactly once. Native completes through the
        // same helper before returning from WebBrowser.
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const callbackResult = await completeOAuthCallback(window.location.href);
          if (callbackResult.error) throw new Error(callbackResult.error);
          window.history.replaceState({}, document.title, window.location.pathname);
          if (isMounted) {
            router.replace('/(tabs)');
            return;
          }
        }

        // 2. معالجة الموبايل والـ APK (Android / iOS Handling)
        if (getAuthSnapshot().user && isMounted) {
          router.replace('/(tabs)');
        } else if (isMounted) {
          router.replace('/');
        }
      } catch (err) {
        console.error('Error in auth callback:', err);
        showToast(err instanceof Error ? err.message : 'تعذر إكمال تسجيل الدخول. حاول مرة أخرى.');
        if (isMounted) router.replace('/');
      }
    };

    handleCallback();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fdfbf7' }}>
      <ActivityIndicator size="large" color="#1a3636" />
      <Text style={{ marginTop: 12, fontSize: 14, color: '#4a5568' }}>جاري إكمال تسجيل الدخول...</Text>
    </View>
  );
}