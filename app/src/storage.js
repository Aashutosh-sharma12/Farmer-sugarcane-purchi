import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// SecureStore on phones, localStorage in the browser (SecureStore has no web support).
export const getItem = async (key) =>
  Platform.OS === 'web' ? window.localStorage.getItem(key) : SecureStore.getItemAsync(key);

export const setItem = async (key, value) =>
  Platform.OS === 'web' ? window.localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value);

export const removeItem = async (key) =>
  Platform.OS === 'web' ? window.localStorage.removeItem(key) : SecureStore.deleteItemAsync(key);
