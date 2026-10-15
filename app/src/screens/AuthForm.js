import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import client, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { COLORS } from '../constants/fields';

// Shared form for Login and Register screens.
export default function AuthForm({ mode, navigation }) {
  const isRegister = mode === 'register';
  const { signIn } = useAuth();
  const { t, lang, setLang } = useLang();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!/^\d{10}$/.test(phone.trim())) return setError(t('errPhone'));
    if (password.length < 6) return setError(t('errPassword'));
    if (isRegister && !name.trim()) return setError(t('errName'));
    setBusy(true);
    try {
      const body = isRegister ? { name: name.trim(), phone: phone.trim(), password } : { phone: phone.trim(), password };
      const { data } = await client.post(isRegister ? '/auth/register' : '/auth/login', body);
      await signIn(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>Purchi Store</Text>
      <Text style={styles.subtitle}>{t('tagline')}</Text>

      {isRegister && (
        <TextInput style={styles.input} placeholder={t('name')} value={name} onChangeText={setName} />
      )}
      <TextInput
        style={styles.input}
        placeholder={t('mobile')}
        keyboardType="phone-pad"
        maxLength={10}
        value={phone}
        onChangeText={setPhone}
      />
      <TextInput
        style={styles.input}
        placeholder={t('password')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <Text style={styles.buttonText}>{isRegister ? t('register') : t('login')}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.replace(isRegister ? 'Login' : 'Register')}>
        <Text style={styles.link}>
          {isRegister ? t('haveAccount') : t('newUser')}
        </Text>
      </Pressable>
      <Pressable onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}>
        <Text style={styles.link}>{t('langSwitch')}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: COLORS.bg },
  title: { fontSize: 30, fontWeight: '700', color: COLORS.primary, textAlign: 'center' },
  subtitle: { fontSize: 16, color: COLORS.muted, textAlign: 'center', marginBottom: 32 },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  error: { color: COLORS.danger, marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 4 },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: '600' },
  link: { color: COLORS.primary, textAlign: 'center', marginTop: 20, fontSize: 15 },
});
