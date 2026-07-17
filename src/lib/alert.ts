import { Alert, Platform } from 'react-native';

// React Native's Alert.alert() has no working implementation on web
// (react-native-web renders nothing), so error/status messages silently
// vanish there. Fall back to window.alert on web, keep native Alert
// everywhere else.
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
