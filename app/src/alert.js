import { Alert, Platform } from 'react-native';

// Same signature as Alert.alert. React Native's Alert does nothing in the browser,
// so there we use window.alert / window.confirm instead.
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') return Alert.alert(title, message, buttons);

  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons || []).filter((b) => b.style !== 'cancel');
  if (!actions.length) {
    window.alert(text);
    buttons?.find((b) => b.onPress)?.onPress?.();
    return;
  }
  // confirm(): OK runs the main action, Cancel does nothing.
  if (window.confirm(text)) actions[actions.length - 1].onPress?.();
}
