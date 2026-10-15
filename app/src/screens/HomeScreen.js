import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import client, { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { COLORS, MONTHS, STATUSES, money, parseAmount, pendingOf, purchiDate, statusInfo } from '../constants/fields';

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const { t, L, lang, setLang } = useLang();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('new'); // 'new' | 'pending'
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear); // null = all years
  const [month, setMonth] = useState(null); // 0-11, null = all months
  const queryRef = useRef('');
  queryRef.current = query.trim();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title: t('titleHome'),
      headerRight: () => (
        <View style={styles.headerRight}>
          <Pressable onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')} hitSlop={10}>
            <Text style={styles.logout}>{t('langSwitch')}</Text>
          </Pressable>
          <Pressable onPress={signOut} hitSlop={10}>
            <Text style={styles.logout}>{t('logout')}</Text>
          </Pressable>
        </View>
      ),
    });
  }, [navigation, signOut, lang]);

  // The whole (searched) list is loaded once; status filter, counts and totals are worked out here.
  const load = useCallback(async (q) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await client.get('/purchi', { params: q ? { q } : {} });
      setItems(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the screen comes back into view (e.g. after saving or deleting).
  useFocusEffect(
    useCallback(() => {
      load(queryRef.current);
    }, [load])
  );

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => load(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query, load]);

  // Years offered in the filter: every year that has a purchi, plus the current year.
  const years = useMemo(() => {
    const set = new Set([currentYear]);
    items.forEach((p) => {
      const d = purchiDate(p);
      if (d) set.add(d.year);
    });
    return [...set].sort((a, b) => b - a);
  }, [items, currentYear]);

  // Purchis inside the chosen year / month. Status counts, list and totals all work on these.
  const inPeriod = useMemo(
    () =>
      items.filter((p) => {
        if (year == null) return true;
        const d = purchiDate(p);
        return d && d.year === year && (month == null || d.month === month);
      }),
    [items, year, month]
  );

  const counts = useMemo(() => {
    const c = { '': inPeriod.length };
    STATUSES.forEach((s) => (c[s.key] = inPeriod.filter((p) => (p.status || 'pending') === s.key).length));
    return c;
  }, [inPeriod]);

  const visible = useMemo(() => {
    const list = status ? inPeriod.filter((p) => (p.status || 'pending') === status) : inPeriod;
    return sort === 'pending' ? [...list].sort((a, b) => (pendingOf(b) ?? -1) - (pendingOf(a) ?? -1)) : list;
  }, [inPeriod, status, sort]);

  // Totals for what is on screen. Cancelled purchis are left out.
  const totals = useMemo(() => {
    let total = 0, got = 0, pending = 0;
    visible.forEach((p) => {
      if (p.status === 'cancelled') return;
      const amount = parseAmount(p.amount);
      if (amount != null) total += amount;
      got += Number(p.receivedAmount) || 0;
      pending += pendingOf(p) ?? 0;
    });
    return { total, got, pending };
  }, [visible]);

  const renderItem = ({ item }) => {
    const st = statusInfo(item.status);
    const pending = pendingOf(item);
    return (
    <Pressable style={styles.card} onPress={() => navigation.navigate('Detail', { id: item._id })}>
      <View style={styles.cardRow}>
        <Text style={styles.number}>#{item.purchiNumber}</Text>
        {!!item.date && <Text style={styles.muted}>{item.date}</Text>}
      </View>
      <View style={[styles.chip, { backgroundColor: st.bg }]}>
        <Text style={[styles.chipText, { color: st.color }]}>{L(st)}</Text>
      </View>
      {!!item.centre && <Text style={styles.line}>{t('centre')}: {item.centre}</Text>}
      {!!item.netWeight && <Text style={styles.line}>{t('netWeight')}: {item.netWeight}</Text>}
      {!!item.amount && <Text style={styles.line}>{t('amount')}: {item.amount}</Text>}
      {pending != null && (
        <View style={styles.moneyRow}>
          <Text style={[styles.money, { color: COLORS.primary }]}>{t('received')}: {money(item.receivedAmount)}</Text>
          <Text style={[styles.money, { color: pending > 0 ? COLORS.warningText : COLORS.primary }]}>
            {pending > 0 ? `${t('balance')}: ${money(pending)}` : item.status === 'cancelled' ? '' : t('allPaid')}
          </Text>
        </View>
      )}
    </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{t('namaste', { name: user?.name })}</Text>
      <TextInput
        style={styles.search}
        placeholder={t('search')}
        value={query}
        onChangeText={setQuery}
        clearButtonMode="while-editing"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={styles.periodContent}>
        {[null, ...years].map((y) => (
          <Pressable
            key={y ?? 'all'}
            onPress={() => { setYear(y); setMonth(null); }}
            style={[styles.filter, year === y && styles.filterOn]}
          >
            <Text style={[styles.filterText, year === y && styles.filterTextOn]}>{y ?? t('allYears')}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {year != null && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodRow} contentContainerStyle={styles.periodContent}>
          {[null, ...MONTHS.keys()].map((m) => (
            <Pressable key={m ?? 'all'} onPress={() => setMonth(m)} style={[styles.month, month === m && styles.monthOn]}>
              <Text style={[styles.monthText, month === m && styles.monthTextOn]}>{m == null ? t('allMonths') : L(MONTHS[m])}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.filters}>
        {[{ key: '', en: 'All', hi: t('all') }, ...STATUSES].map((s) => (
          <Pressable
            key={s.key}
            onPress={() => setStatus(s.key)}
            style={[styles.filter, status === s.key && styles.filterOn]}
          >
            <Text style={[styles.filterText, status === s.key && styles.filterTextOn]}>
              {L(s)} ({counts[s.key] ?? 0})
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length > 0 && (
        <>
          <View style={styles.summary}>
            <View style={styles.sumCol}>
              <Text style={styles.sumLabel}>{t('total')}</Text>
              <Text style={styles.sumValue}>{money(totals.total)}</Text>
            </View>
            <View style={styles.sumCol}>
              <Text style={styles.sumLabel}>{t('received')}</Text>
              <Text style={[styles.sumValue, { color: COLORS.primary }]}>{money(totals.got)}</Text>
            </View>
            <View style={styles.sumCol}>
              <Text style={styles.sumLabel}>{t('balance')}</Text>
              <Text style={[styles.sumValue, { color: totals.pending > 0 ? COLORS.warningText : COLORS.primary }]}>
                {money(totals.pending)}
              </Text>
            </View>
          </View>
          <View style={styles.sortRow}>
            <Text style={styles.count}>{t('shown', { n: visible.length })}</Text>
            <View style={styles.sortOptions}>
              {[['new', 'sortNew'], ['pending', 'sortPending']].map(([key, label]) => (
                <Pressable key={key} onPress={() => setSort(key)}>
                  <Text style={[styles.sortText, sort === key && styles.sortOn]}>{t(label)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={visible}
        keyExtractor={(i) => i._id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => load(query.trim())} />}
        ListEmptyComponent={
          !loading && (
            <View>
              <Text style={styles.empty}>
                {items.length && inPeriod.length === 0 && year != null
                  ? t('noPurchiYear')
                  : query || status
                    ? t('noPurchiSearch')
                    : t('noPurchiYet')}
              </Text>
              {items.length > 0 && year != null && (
                <Pressable onPress={() => { setYear(null); setMonth(null); }}>
                  <Text style={styles.showAll}>{t('allYears')}</Text>
                </Pressable>
              )}
            </View>
          )
        }
      />
      <Pressable style={[styles.fab, { bottom: 32 + insets.bottom }]} onPress={() => navigation.navigate('Scan')}>
        <Text style={styles.fabText}>{t('addPurchi')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16 },
  greeting: { fontSize: 18, fontWeight: '600', marginTop: 12, color: COLORS.text },
  search: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginVertical: 12,
    fontSize: 15,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  number: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  muted: { color: COLORS.muted },
  chip: { alignSelf: 'flex-start', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  periodRow: { flexGrow: 0, marginBottom: 8 },
  periodContent: { gap: 6, paddingRight: 8 },
  month: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#E8EEE8' },
  monthOn: { backgroundColor: COLORS.primary },
  monthText: { color: COLORS.text, fontSize: 12 },
  monthTextOn: { color: COLORS.white, fontWeight: '700' },
  showAll: { color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  filter: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.white },
  filterOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: COLORS.text, fontSize: 13 },
  filterTextOn: { color: COLORS.white, fontWeight: '700' },
  line: { color: COLORS.text, marginTop: 2 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8, flexWrap: 'wrap' },
  money: { fontWeight: '700', fontSize: 14 },
  summary: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  sumCol: { flex: 1 },
  sumLabel: { color: COLORS.muted, fontSize: 12 },
  sumValue: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  count: { color: COLORS.muted, fontSize: 13 },
  sortOptions: { flexDirection: 'row', gap: 14 },
  sortText: { color: COLORS.muted, fontSize: 13 },
  sortOn: { color: COLORS.primary, fontWeight: '700' },
  error: { color: COLORS.danger, marginBottom: 8 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 60, lineHeight: 22 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 32,
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  headerRight: { flexDirection: 'row', gap: 16 },
  logout: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});
