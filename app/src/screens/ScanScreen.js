import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { showAlert } from '../alert';
import client, { errorMessage } from '../api/client';
import { useLang } from '../context/LangContext';
import { COLORS } from '../constants/fields';

const MAX_WIDTH = 1600;

export default function ScanScreen({ navigation }) {
  const { t } = useLang();
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (fromCamera) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return showAlert(t('permNeeded'), t(fromCamera ? 'permCamera' : 'permGallery'));
    }
    const options = { mediaTypes: ['images'], quality: 1 };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setImage(result.assets[0]);
  };

  // Shrink large photos so upload is fast and stays within the free Gemini quota.
  const prepareImage = async (asset) => {
    const ctx = ImageManipulator.manipulate(asset.uri);
    if (asset.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
    const rendered = await ctx.renderAsync();
    return rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  };

  const upload = async () => {
    setBusy(true);
    try {
      const prepared = await prepareImage(image);
      const form = new FormData();
      if (Platform.OS === 'web') {
        form.append('image', await (await fetch(prepared.uri)).blob(), 'purchi.jpg');
      } else {
        form.append('image', { uri: prepared.uri, name: 'purchi.jpg', type: 'image/jpeg' });
      }
      const { data } = await client.post('/purchi/extract', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigation.replace('Review', { ...data, imageUri: prepared.uri });
    } catch (err) {
      const res = err.response;
      if (res?.status === 409 && res.data?.purchi) {
        const msg = res.data.reason === 'image' ? t('dupImage') : t('dupNumber', { n: res.data.purchi.purchiNumber });
        showAlert(t('alreadySaved'), msg, [
          { text: t('ok'), style: 'cancel' },
          { text: t('viewPurchi'), onPress: () => navigation.replace('Detail', { id: res.data.purchi._id }) },
        ]);
      } else if (res?.status === 422 && res.data?.code === 'notPurchi') {
        setImage(null); // the photo is rejected, so the farmer starts over with a new one
        showAlert(t('notPurchiTitle'), t('notPurchiMsg'));
      } else {
        showAlert(t('uploadFailed'), errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      {image ? (
        <Image source={{ uri: image.uri }} style={styles.preview} resizeMode="contain" />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={styles.placeholderText}>{t('scanHint')}</Text>
        </View>
      )}

      <View style={styles.row}>
        <Pressable style={[styles.button, styles.outline]} onPress={() => pick(true)} disabled={busy}>
          <Text style={styles.outlineText}>{t('camera')}</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.outline]} onPress={() => pick(false)} disabled={busy}>
          <Text style={styles.outlineText}>{t('gallery')}</Text>
        </Pressable>
      </View>

      {image && (
        <Pressable style={styles.button} onPress={upload} disabled={busy}>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={COLORS.white} />
              <Text style={styles.buttonText}>{t('reading')}</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>{t('uploadRead')}</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: COLORS.bg },
  preview: { flex: 1, borderRadius: 12, backgroundColor: '#000', marginBottom: 16 },
  placeholder: {
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.primary,
  },
  placeholderText: { textAlign: 'center', color: COLORS.primary, fontSize: 16, lineHeight: 24, padding: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  button: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    flexGrow: 0,
    flexBasis: 'auto',
  },
  outline: { flex: 1, flexGrow: 1, backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.primary },
  outlineText: { color: COLORS.primary, fontSize: 16, fontWeight: '600' },
  buttonText: { color: COLORS.white, fontSize: 17, fontWeight: '700' },
  busy: { flexDirection: 'row', alignItems: 'center' },
});
