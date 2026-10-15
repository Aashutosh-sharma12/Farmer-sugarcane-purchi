import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLang } from '../context/LangContext';
import { COLORS } from '../constants/fields';
import { MILLS, millLabel } from '../constants/mills';

// Dropdown for the mill name. Works the same on phones and in the browser.
export default function MillPicker({ value, onChange }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const isListed = MILLS.some((m) => m.hi === value);
  const display = value ? millLabel(value, lang) : '';

  const choose = (name) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <>
      <Pressable style={styles.field} onPress={() => { setCustom(isListed ? '' : value || ''); setOpen(true); }}>
        <Text style={[styles.fieldText, !display && styles.placeholder]} numberOfLines={2}>
          {display || t('selectMill')}
        </Text>
        <Text style={styles.arrow}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.title}>{t('selectMill')}</Text>
            <ScrollView>
              {MILLS.map((m) => (
                <Pressable key={m.hi} style={[styles.option, m.hi === value && styles.optionOn]} onPress={() => choose(m.hi)}>
                  <Text style={[styles.optionText, m.hi === value && styles.optionTextOn]}>{m[lang] ?? m.en}</Text>
                </Pressable>
              ))}
              <View style={styles.other}>
                <Text style={styles.otherLabel}>{t('otherMill')}</Text>
                <TextInput style={styles.input} value={custom} onChangeText={setCustom} placeholder={t('otherMillPlaceholder')} />
                <Pressable
                  style={[styles.useButton, !custom.trim() && { opacity: 0.4 }]}
                  disabled={!custom.trim()}
                  onPress={() => choose(custom.trim())}
                >
                  <Text style={styles.useText}>{t('ok')}</Text>
                </Pressable>
              </View>
            </ScrollView>
            {!!value && (
              <Pressable onPress={() => choose('')}>
                <Text style={styles.clear}>{t('clearMill')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
  },
  fieldText: { flex: 1, fontSize: 15, color: COLORS.text },
  placeholder: { color: COLORS.muted },
  arrow: { color: COLORS.muted, marginLeft: 8, fontSize: 16 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, maxHeight: '85%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  option: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 8 },
  optionOn: { backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 15, color: COLORS.text },
  optionTextOn: { color: COLORS.primary, fontWeight: '700' },
  other: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 8, paddingTop: 12 },
  otherLabel: { color: COLORS.muted, fontSize: 13, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 15 },
  useButton: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  useText: { color: COLORS.white, fontWeight: '700' },
  clear: { color: COLORS.danger, textAlign: 'center', paddingTop: 12, fontWeight: '600' },
});
