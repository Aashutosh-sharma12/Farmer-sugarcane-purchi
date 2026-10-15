import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { showAlert } from '../alert';
import client, { errorMessage, imageUrl } from '../api/client';
import { useLang } from '../context/LangContext';
import { millLabel } from '../constants/mills';
import { COLORS, COMMON_FIELDS, FIELD_GROUPS, STATUSES, parseAmount, statusInfo } from '../constants/fields';

export default function DetailScreen({ route, navigation }) {
  const { id, justSaved } = route.params;
  const { t, L, lang } = useLang();
  const [zoomUri, setZoomUri] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [purchi, setPurchi] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('pending');
  const [received, setReceived] = useState('');
  const [saving, setSaving] = useState(false);

  const load = (p) => {
    setPurchi(p);
    setStatus(p.status || 'pending');
    setReceived(p.receivedAmount ? String(p.receivedAmount) : '');
  };

  // Pick a sensible status when the received amount changes (farmer can still override).
  const onReceivedChange = (text) => {
    setReceived(text);
    const got = parseFloat(text);
    const total = parseAmount(purchi?.amount);
    if (!Number.isFinite(got) || got <= 0) return setStatus((s) => (s === 'partial' || s === 'received' ? 'pending' : s));
    if (total != null && got >= total) setStatus('received');
    else setStatus((s) => (s === 'pending' || s === 'received' ? 'partial' : s));
  };

  const savePayment = async () => {
    if (received !== '' && !(Number(received) >= 0)) return showAlert(t('invalidAmount'), t('invalidAmountMsg'));
    setSaving(true);
    try {
      const { data } = await client.patch(`/purchi/${id}`, { status, receivedAmount: received === '' ? 0 : Number(received) });
      load(data);
      showAlert(t('saveDone'), t('paymentUpdated'));
    } catch (err) {
      showAlert(t('couldNotSave'), errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      client
        .get(`/purchi/${id}`)
        .then(({ data }) => active && load(data))
        .catch((err) => active && setError(errorMessage(err)));
      return () => {
        active = false;
      };
    }, [id])
  );

  const remove = () => {
    showAlert(t('deleteTitle'), t('deleteMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await client.delete(`/purchi/${id}`);
            navigation.popToTop();
          } catch (err) {
            showAlert(t('couldNotDelete'), errorMessage(err));
          }
        },
      },
    ]);
  };

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!purchi) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const fieldByKey = Object.fromEntries(COMMON_FIELDS.map((f) => [f.key, f]));
  const total = parseAmount(purchi.amount);
  const receivedNum = Number(received) || 0;
  const balance = total != null ? Math.max(total - receivedNum, 0) : null;
  const st = statusInfo(status);

  // Cross-check the slip's own arithmetic. Mills may deduct things, so these are hints only.
  const gross = parseAmount(purchi.grossWeight);
  const tare = parseAmount(purchi.tareWeight);
  const cane = parseAmount(purchi.caneWeight);
  const deduction = parseAmount(purchi.deduction);
  const net = parseAmount(purchi.netWeight);
  const rate = parseAmount(purchi.rate);
  const fmt = (n) => String(Math.round(n * 100) / 100);
  const checks = [];
  const near = (a, b) => Math.abs(a - b) <= 0.05;
  if (gross != null && tare != null && cane != null) {
    checks.push(
      near(gross - tare, cane)
        ? { ok: true, text: t('calcOkCane') }
        : { ok: false, text: t('calcCane', { v: fmt(gross - tare), s: fmt(cane) }) }
    );
  }
  const baseCane = cane ?? (gross != null && tare != null ? gross - tare : null);
  if (baseCane != null && net != null) {
    const expected = baseCane - (deduction ?? 0);
    const withDeduction = deduction != null;
    checks.push(
      near(expected, net)
        ? { ok: true, text: t(withDeduction ? 'calcOkDed' : 'calcOk') }
        : { ok: false, text: t(withDeduction ? 'calcDed' : 'calcNet', { v: fmt(expected), s: fmt(net) }) }
    );
  }
  if (net != null && rate != null && total != null) {
    const expected = net * rate;
    checks.push(
      Math.abs(expected - total) <= Math.max(1, expected * 0.005)
        ? { ok: true, text: t('calcOkAmount') }
        : { ok: false, text: t('calcAmount', { v: fmt(expected), s: fmt(total) }) }
    );
  }

  const when = (iso) => {
    try {
      return new Date(iso).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return String(iso);
    }
  };
  const tiles = [
    purchi.netWeight && { label: t('netWeight'), value: purchi.netWeight },
    purchi.rate && { label: L(fieldByKey.rate), value: purchi.rate },
    purchi.amount && { label: t('amount'), value: purchi.amount },
    { label: t('paid'), value: `₹${receivedNum}`, color: COLORS.primary },
    balance != null && { label: t('balance'), value: `₹${balance}`, color: balance > 0 ? COLORS.warningText : COLORS.primary },
  ].filter(Boolean);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      {!!justSaved && <Text style={styles.saved}>{t('saved')}</Text>}
      <Pressable onPress={() => setZoomUri(imageUrl(purchi.imagePath))}>
        <Image source={{ uri: imageUrl(purchi.imagePath) }} style={styles.image} resizeMode="contain" />
      </Pressable>
      <Text style={styles.zoomHint}>{t('tapToZoom')}</Text>
      <View style={styles.hero}>
        <Text style={styles.number}>#{purchi.purchiNumber}</Text>
        <View style={[styles.chip, { backgroundColor: st.bg }]}>
          <Text style={[styles.chipText, { color: st.color }]}>{L(st)}</Text>
        </View>
      </View>
      {!!purchi.date && <Text style={styles.subline}>{purchi.date}</Text>}

      <Text style={styles.sectionTitle}>{t('summary')}</Text>
      <View style={styles.tiles}>
        {tiles.map((x) => (
          <View key={x.label} style={styles.tile}>
            <Text style={styles.tileLabel}>{x.label}</Text>
            <Text style={[styles.tileValue, x.color && { color: x.color }]}>{x.value}</Text>
          </View>
        ))}
      </View>

      {checks.length > 0 && (
        <View style={[styles.card, { marginTop: 12 }]}>
          <Text style={styles.cardTitle}>{t('calcCheck')}</Text>
          {checks.map((c, i) => (
            <Text key={i} style={[styles.check, { color: c.ok ? COLORS.primary : COLORS.warningText }]}>
              {c.text}
            </Text>
          ))}
          {checks.some((c) => !c.ok) && <Text style={styles.note}>{t('calcNote')}</Text>}
        </View>
      )}

      <Text style={styles.sectionTitle}>{t('payment')}</Text>
      <View style={styles.card}>
        <Text style={styles.key}>{t('status')}</Text>
        <View style={styles.statusWrap}>
          {STATUSES.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setStatus(s.key)}
              style={[styles.statusOpt, { borderColor: s.color }, status === s.key && { backgroundColor: s.color }]}
            >
              <Text style={[styles.statusText, { color: status === s.key ? '#FFF' : s.color }]}>{L(s)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.key, { marginTop: 12 }]}>{t('receivedAmount')}</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={received}
          onChangeText={onReceivedChange}
          placeholder="0"
        />
        {total != null && (
          <Text style={styles.balance}>
            {t('total')} ₹{total}  |  {t('balance')} ₹{balance}
          </Text>
        )}
        <Pressable style={styles.saveButton} onPress={savePayment} disabled={saving}>
          {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>{t('savePayment')}</Text>}
        </Pressable>
      </View>

      {FIELD_GROUPS.map((g) => {
        const rows = g.keys.filter((k) => purchi[k]);
        if (!rows.length) return null;
        return (
          <View key={g.id}>
            <Text style={styles.sectionTitle}>{t(`group_${g.id}`)}</Text>
            <View style={styles.card}>
              {rows.map((k) => (
                <View key={k} style={styles.row}>
                  <Text style={styles.key}>{L(fieldByKey[k])}</Text>
                  <Text style={styles.value}>{k === 'millName' ? millLabel(purchi[k], lang) : purchi[k]}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}

      {purchi.fields?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('allFields')}</Text>
          <View style={styles.card}>
            {purchi.fields.map((f, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.key}>{f.key}</Text>
                <Text style={styles.value}>{f.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>{t('recordInfo')}</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.key}>{t('savedOn')}</Text>
          <Text style={styles.value}>{when(purchi.createdAt)}</Text>
        </View>
        {purchi.updatedAt && purchi.updatedAt !== purchi.createdAt && (
          <View style={styles.row}>
            <Text style={styles.key}>{t('updatedOn')}</Text>
            <Text style={styles.value}>{when(purchi.updatedAt)}</Text>
          </View>
        )}
      </View>

      {!!purchi.rawText && (
        <>
          <Pressable style={styles.rawHeader} onPress={() => setShowRaw((v) => !v)}>
            <Text style={styles.sectionTitleInline}>{t('rawText')}</Text>
            <Text style={styles.toggle}>{showRaw ? t('hideText') : t('showText')}</Text>
          </Pressable>
          {showRaw && (
            <View style={styles.card}>
              <Text selectable style={styles.raw}>{purchi.rawText}</Text>
            </View>
          )}
        </>
      )}

      <Modal visible={!!zoomUri} transparent animationType="fade" onRequestClose={() => setZoomUri(null)}>
        <View style={styles.modal}>
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            contentContainerStyle={styles.modalContent}
            centerContent
          >
            <Image source={{ uri: zoomUri }} style={styles.zoomImage} resizeMode="contain" />
          </ScrollView>
          <Pressable style={styles.closeButton} onPress={() => setZoomUri(null)}>
            <Text style={styles.closeText}>{t('close')}</Text>
          </Pressable>
        </View>
      </Modal>

      <Pressable style={styles.deleteButton} onPress={remove}>
        <Text style={styles.deleteText}>{t('deletePurchi')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  error: { color: COLORS.danger, padding: 16 },
  saved: { color: COLORS.primary, fontWeight: '700', marginBottom: 10, fontSize: 15 },
  image: { width: '100%', height: 260, borderRadius: 12, backgroundColor: '#000', marginBottom: 6 },
  zoomHint: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginBottom: 10 },
  hero: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  number: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  subline: { color: COLORS.muted, marginTop: 4 },
  chip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  chipText: { fontSize: 13, fontWeight: '700' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { backgroundColor: COLORS.white, borderRadius: 12, padding: 12, flexGrow: 1, flexBasis: '30%', minWidth: 100 },
  tileLabel: { color: COLORS.muted, fontSize: 12 },
  tileValue: { color: COLORS.text, fontSize: 17, fontWeight: '700', marginTop: 4 },
  cardTitle: { fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  check: { marginTop: 4, lineHeight: 20 },
  note: { color: COLORS.muted, fontSize: 12, marginTop: 8 },
  rawHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 },
  sectionTitleInline: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
  toggle: { color: COLORS.primary, fontWeight: '600' },
  raw: { color: COLORS.text, lineHeight: 20 },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  modalContent: { flexGrow: 1, justifyContent: 'center' },
  zoomImage: { width: '100%', height: 600 },
  closeButton: { position: 'absolute', top: 40, right: 16, backgroundColor: COLORS.white, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 8 },
  closeText: { color: COLORS.text, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 12 },
  key: { color: COLORS.muted, flex: 1 },
  value: { color: COLORS.text, fontWeight: '600', flex: 1, textAlign: 'right' },
  statusWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  statusOpt: { borderWidth: 1.5, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 },
  statusText: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 16, marginTop: 6, backgroundColor: COLORS.white },
  balance: { color: COLORS.muted, marginTop: 8 },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 14 },
  saveText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  deleteButton: { marginTop: 28, padding: 14, alignItems: 'center' },
  deleteText: { color: COLORS.danger, fontWeight: '600' },
});
