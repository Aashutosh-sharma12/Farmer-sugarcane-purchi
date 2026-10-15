import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { showAlert } from '../alert';
import MillPicker from '../components/MillPicker';
import { DEFAULT_MILL } from '../constants/mills';
import { getItem, setItem } from '../storage';
import client, { errorMessage } from '../api/client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLang } from '../context/LangContext';
import { COLORS, COMMON_FIELDS } from '../constants/fields';

const LAST_MILL_KEY = 'purchi_last_mill';

// Review & correct the data Gemini extracted before it is saved.
export default function ReviewScreen({ route, navigation }) {
  const { imageHash, imageUri, warning, data } = route.params;
  const { t, L } = useLang();
  const insets = useSafeAreaInsets();
  const [purchiNumber, setPurchiNumber] = useState(data.purchiNumber || '');
  const [values, setValues] = useState(
    Object.fromEntries(COMMON_FIELDS.map((f) => [f.key, data[f.key] || (f.key === 'millName' ? DEFAULT_MILL : '')]))
  );
  // Brajnathpur is preselected. A farmer who last chose another mill gets that one instead.
  useEffect(() => {
    if (data.millName) return;
    getItem(LAST_MILL_KEY).then((m) => m && setValues((prev) => ({ ...prev, millName: m }))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [fields, setFields] = useState(data.fields?.length ? data.fields : [{ key: '', value: '' }]);
  const [busy, setBusy] = useState(false);

  const setField = (i, prop, text) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [prop]: text } : f)));
  const addField = () => setFields((prev) => [...prev, { key: '', value: '' }]);
  const removeField = (i) => setFields((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!purchiNumber.trim()) return showAlert(t('purchiNumReqTitle'), t('purchiNumReqMsg'));
    setBusy(true);
    try {
      const { data: saved } = await client.post('/purchi', {
        imageHash,
        purchiNumber,
        ...values,
        fields: fields.filter((f) => f.key.trim()),
        rawText: data.rawText || '',
      });
      if (values.millName) setItem(LAST_MILL_KEY, values.millName).catch(() => {});
      navigation.replace('Detail', { id: saved._id, justSaved: true });
    } catch (err) {
      const res = err.response;
      if (res?.status === 409 && res.data?.purchi) {
        const msg = res.data.reason === 'image' ? t('dupImage') : t('dupNumber', { n: res.data.purchi.purchiNumber });
        showAlert(t('alreadySaved'), msg, [
          { text: t('ok'), style: 'cancel' },
          { text: t('viewPurchi'), onPress: () => navigation.replace('Detail', { id: res.data.purchi._id }) },
        ]);
      } else {
        showAlert(t('couldNotSave'), errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
      {!!warning && (
        <Text style={styles.warning}>
          {t({ noNumber: 'warnNoNumber', busy: 'warnBusy', noValues: 'warnNoValues', verify: 'warnVerify' }[warning] || 'warnUnreadable')}
        </Text>
      )}

      <Text style={styles.sectionTitle}>{t('purchiNumber')}</Text>
      <TextInput
        style={styles.input}
        value={purchiNumber}
        onChangeText={setPurchiNumber}
        placeholder={t('purchiNumberPlaceholder')}
        autoCapitalize="characters"
      />

      <Text style={styles.sectionTitle}>{t('details')}</Text>
      {COMMON_FIELDS.map((f) => (
        <View key={f.key} style={styles.fieldRow}>
          <Text style={styles.label}>{L(f)}</Text>
          {f.key === 'millName' ? (
            <MillPicker value={values.millName} onChange={(m) => setValues((prev) => ({ ...prev, millName: m }))} />
          ) : (
            <TextInput
              style={styles.input}
              value={values[f.key]}
              onChangeText={(t) => setValues((prev) => ({ ...prev, [f.key]: t }))}
            />
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>{t('allFields')}</Text>
      <Text style={styles.hint}>{t('allFieldsHint')}</Text>
      {fields.map((f, i) => (
        <View key={i} style={styles.kvRow}>
          <TextInput
            style={[styles.input, styles.kvKey]}
            value={f.key}
            onChangeText={(t) => setField(i, 'key', t)}
            placeholder={t('label')}
          />
          <TextInput
            style={[styles.input, styles.kvValue]}
            value={f.value}
            onChangeText={(t) => setField(i, 'value', t)}
            placeholder={t('value')}
          />
          <Pressable onPress={() => removeField(i)} hitSlop={10} style={styles.removeBtn}>
            <Text style={styles.removeText}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Pressable onPress={addField}>
        <Text style={styles.addLink}>{t('addRow')}</Text>
      </Pressable>

      <Pressable style={styles.saveButton} onPress={save} disabled={busy}>
        {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>{t('savePurchi')}</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  image: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000', marginBottom: 12 },
  warning: {
    backgroundColor: COLORS.warning,
    color: COLORS.warningText,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 16, marginBottom: 6 },
  hint: { color: COLORS.muted, fontSize: 13, marginBottom: 8 },
  fieldRow: { marginBottom: 8 },
  label: { color: COLORS.muted, fontSize: 13, marginBottom: 4 },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
  },
  kvRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  kvKey: { flex: 1 },
  kvValue: { flex: 1 },
  removeBtn: { padding: 6 },
  removeText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' },
  addLink: { color: COLORS.primary, fontWeight: '600', marginBottom: 20 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 16, alignItems: 'center' },
  saveText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
});
