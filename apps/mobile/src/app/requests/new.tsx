import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, categoryLabel, requestKeys, unwrap, useApi, useTaxonomy, type PreferredTime, type PublicListing, type PublicProfile } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, Chip, EmptyState, FieldLabel, FormError, IconButton, Input, Reassurance, SelectField, ui } from '@/components/ui';
import { groupDigits, nairaToKobo } from '@/lib/format';
import { useAccount } from '@/lib/session';
import { uploadPhoto } from '@/lib/uploads';
import { color, gutter, radius, space, type } from '@/theme';

const MAX_PHOTOS = 5;
const TIMES: PreferredTime[] = ['any', 'morning', 'afternoon', 'evening'];

type Photo = { key: string; uri: string; asset: ImagePicker.ImagePickerAsset; uploadId?: string; state: 'uploading' | 'done' | 'failed' };

/** YYYY-MM-DD in Lagos time, `offset` days from today. */
function day(offset: number): string {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * Request a quote (REQ-01): from a service listing (`?listing=`) or a provider's page (`?profile=`).
 * What is needed, where, when (one of the next two weeks, or any day) and an optional budget, with
 * photos. Sent once (Idempotency-Key); WHY ME may check it first, then the provider accepts,
 * declines or sends a price.
 */
export default function NewRequestScreen() {
  const { t, i18n } = useTranslation(['requests', 'common', 'seller', 'errors']);
  const { listing: listingId, profile: profileId } = useLocalSearchParams<{ listing?: string; profile?: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const { status, user } = useAccount();
  const taxonomy = useTaxonomy();
  const target = useQuery({
    queryKey: ['request-target', listingId ?? null, profileId ?? null],
    queryFn: async () =>
      listingId
        ? { listing: unwrap(await api.GET('/v1/listings/{listing}', { params: { path: { listing: listingId } } })).data as PublicListing }
        : { profile: unwrap(await api.GET('/v1/profiles/{profile}', { params: { path: { profile: profileId! } } })).data as PublicProfile },
    enabled: Boolean(listingId || profileId),
  });
  const listing = target.data?.listing;
  const profile = target.data?.profile;

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [locationId, setLocationId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<PreferredTime>('any');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(Crypto.randomUUID());
  const createdAt = useRef(new Date().toISOString());
  const working = useRef(false);

  // Defaults from the listing or page, until the person chooses.
  const chosenCategory = categoryId ?? listing?.category.id ?? profile?.category?.id ?? null;
  const chosenLocation = locationId ?? listing?.location.id ?? profile?.location?.id ?? null;

  const categories = (taxonomy.data?.categories ?? [])
    .filter((c) => c.type === 'service')
    .map((c) => ({ value: c.id, label: categoryLabel(c, i18n.language) ?? '' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const areas = (() => {
    const all = taxonomy.data?.locations ?? [];
    const lgas = all.filter((l) => l.type === 'lga').sort((a, b) => a.name.localeCompare(b.name));
    return lgas.flatMap((lga) => [
      { value: lga.id, label: t('seller:wholeLga', { name: lga.name }) },
      ...all.filter((l) => l.type === 'area' && l.parent_id === lga.id).sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: `${a.name}, ${lga.name}` })),
    ]);
  })();
  const days = Array.from({ length: 14 }, (_, i) => day(i));

  if (status !== 'signed_in') {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState icon="tools" title={t('common:app.signInNeeded')} action={<Button label={t('common:app.signIn')} onPress={() => router.replace('/sign-in')} />} />
      </SafeAreaView>
    );
  }
  if (!user?.phone_verified_at) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState icon="shield" title={t('common:app.listing.confirmFirst')} action={<Button label={t('common:app.account.confirmPhone')} onPress={() => router.replace('/confirm-phone')} />} />
      </SafeAreaView>
    );
  }
  if (!listingId && !profileId) {
    return (
      <SafeAreaView style={styles.screen}>
        <EmptyState icon="tools" title={t('targetMissing')} />
      </SafeAreaView>
    );
  }

  async function addPhotos() {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: room, quality: 0.85 });
    if (result.canceled) return;
    const picked: Photo[] = result.assets.slice(0, room).map((asset) => ({ key: Crypto.randomUUID(), uri: asset.uri, asset, state: 'uploading' }));
    setPhotos((current) => [...current, ...picked]);
    picked.forEach((photo) => void send(photo));
  }

  async function send(photo: Photo) {
    setPhotos((current) => current.map((p) => (p.key === photo.key ? { ...p, state: 'uploading' } : p)));
    try {
      const upload = await uploadPhoto(photo.asset, photo.key, 'request_photo');
      setPhotos((current) => current.map((p) => (p.key === photo.key ? { ...p, uploadId: upload.id, state: 'done' } : p)));
    } catch {
      setPhotos((current) => current.map((p) => (p.key === photo.key ? { ...p, state: 'failed' } : p)));
    }
  }

  async function submit() {
    if (working.current) return;
    const found: Record<string, string> = {};
    if (title.trim().length < 3) found.title = t('titleRequired');
    if (!chosenCategory) found.category = t('categoryRequired');
    if (!chosenLocation) found.location = t('locationRequired');
    if (description.trim().length < 10) found.description = t('descriptionRequired');
    const min = nairaToKobo(budgetMin);
    const max = nairaToKobo(budgetMax);
    if ((min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max)) || (min !== null && max !== null && min > max)) found.budget = t('budgetInvalid');
    if (photos.some((p) => p.state === 'uploading')) found.photos = t('seller:waitForPhotos');
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    working.current = true;
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(listingId ? { listing_id: listingId } : { profile_id: profileId }),
        category_id: chosenCategory!,
        location_id: chosenLocation!,
        title: title.trim(),
        description: description.trim(),
        preferred_date: date,
        preferred_time: time,
        budget_min_kobo: min,
        budget_max_kobo: max,
        photo_ids: photos.filter((p) => p.uploadId).map((p) => p.uploadId!),
        client_id: key.current,
        client_created_at: createdAt.current,
      };
      const created = unwrap(await api.POST('/v1/requests', { body: body as never, headers: { 'Idempotency-Key': key.current } })).data;
      await queryClient.invalidateQueries({ queryKey: requestKeys.all });
      router.replace({ pathname: '/requests/[id]', params: { id: (created as { id: string }).id } });
    } catch (e) {
      const apiError = e instanceof ApiRequestError ? e : null;
      const fields = apiError?.body?.fields ?? {};
      setError(Object.values(fields)[0]?.[0] ?? t(errorKey(apiError?.code ?? 'network_error')));
      working.current = false;
      setBusy(false);
    }
  }

  const name = listing?.title ?? profile?.display_name ?? '';
  const dateLabel = (iso: string, i: number) =>
    i === 0 ? t('common:app.requests.today') : i === 1 ? t('common:app.requests.tomorrow') : new Intl.DateTimeFormat(i18n.language === 'ig' ? 'ig-NG' : 'en-NG', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }).format(new Date(`${iso}T12:00:00+01:00`));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.bar}>
        <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} size={44} bordered={false} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={type.display} accessibilityRole="header">{t('common:app.requests.requestQuote')}</Text>
          {name ? (
            <View style={[ui.card, styles.target]}>
              <Icon name="tools" size={22} tint={color.green} />
              <Text style={[type.bodyStrong, { flex: 1 }]} numberOfLines={2}>{t('common:app.requests.forWhat', { name })}</Text>
            </View>
          ) : null}
          <Text style={[type.body, { color: color.muted }]}>{t('newIntro')}</Text>
          <FormError message={error} />

          <FieldLabel>{t('titleLabel')}</FieldLabel>
          <Input value={title} onChangeText={setTitle} accessibilityLabel={t('titleLabel')} placeholder={t('titleHint')} maxLength={120} error={errors.title} />
          <FieldLabel>{t('categoryLabel')}</FieldLabel>
          <SelectField value={chosenCategory} options={categories} onChange={setCategoryId} placeholder={t('categoryLabel')} title={t('categoryLabel')} searchPlaceholder={t('categoryLabel')} error={errors.category} />
          <FieldLabel>{t('locationLabel')}</FieldLabel>
          <SelectField value={chosenLocation} options={areas} onChange={setLocationId} placeholder={t('locationLabel')} title={t('locationLabel')} icon="pin" searchPlaceholder={t('locationLabel')} error={errors.location} />
          <FieldLabel>{t('descriptionLabel')}</FieldLabel>
          <Input value={description} onChangeText={setDescription} accessibilityLabel={t('descriptionLabel')} placeholder={t('descriptionHint')} multiline maxLength={2000} error={errors.description} />

          <Text style={[type.heading, { marginTop: space.sm }]}>{t('whenAndBudget')}</Text>
          <FieldLabel>{t('preferredDate')}</FieldLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            <Chip label={t('common:app.requests.anyDay')} selected={date === null} onPress={() => setDate(null)} />
            {days.map((iso, i) => (
              <Chip key={iso} label={dateLabel(iso, i)} selected={date === iso} onPress={() => setDate(iso)} />
            ))}
          </ScrollView>
          <FieldLabel>{t('preferredTime')}</FieldLabel>
          <View style={styles.wrap}>
            {TIMES.map((value) => (
              <Chip key={value} label={t(`time.${value}`)} selected={time === value} onPress={() => setTime(value)} />
            ))}
          </View>
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <FieldLabel>{t('budgetMin')}</FieldLabel>
              <Input value={budgetMin} onChangeText={(v) => setBudgetMin(groupDigits(v))} accessibilityLabel={t('budgetMin')} keyboardType="number-pad" placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel>{t('budgetMax')}</FieldLabel>
              <Input value={budgetMax} onChangeText={(v) => setBudgetMax(groupDigits(v))} accessibilityLabel={t('budgetMax')} keyboardType="number-pad" placeholder="0" />
            </View>
          </View>
          {errors.budget ? <Text style={styles.error}>{errors.budget}</Text> : <Text style={type.small}>{t('budgetHint')}</Text>}

          <FieldLabel>{t('photosTitle')}</FieldLabel>
          <Text style={type.small}>{t('photosHint', { max: MAX_PHOTOS })}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
            {photos.map((photo) => (
              <View key={photo.key} style={styles.photo}>
                <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <Pressable accessibilityRole="button" accessibilityLabel={t('common:app.sell.removePhoto')} onPress={() => setPhotos((current) => current.filter((p) => p.key !== photo.key))} hitSlop={6} style={styles.trash}>
                  <Icon name="trash" size={18} tint={color.ink} />
                </Pressable>
                {photo.state !== 'done' ? (
                  <Pressable accessibilityRole="button" disabled={photo.state !== 'failed'} onPress={() => void send(photo)} style={styles.photoState}>
                    {photo.state === 'uploading' ? <ActivityIndicator color={color.white} /> : <Text style={styles.photoStateText}>{t('common:app.sell.uploadFailed')}</Text>}
                  </Pressable>
                ) : null}
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('seller:addPhoto')} onPress={() => void addPhotos()} style={[styles.photo, styles.addPhoto]}>
                <Icon name="camera" size={30} tint={color.green} />
                <Text style={styles.addText}>{t('seller:addPhoto')}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
          {errors.photos ? <Text style={styles.error}>{errors.photos}</Text> : null}

          <Reassurance title={t('safetyNote')} />
          <Button label={busy ? t('submitting') : t('submit')} busy={busy} onPress={() => void submit()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  bar: { flexDirection: 'row', paddingHorizontal: space.sm, paddingVertical: space.xs },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 560, width: '100%', alignSelf: 'center' },
  target: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  twoCol: { flexDirection: 'row', gap: space.md },
  photo: { width: 112, height: 100, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.field },
  trash: { position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: radius.sm, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  photoState: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.sm },
  photoStateText: { color: color.white, fontWeight: '700', textAlign: 'center', fontSize: 12 },
  addPhoto: { backgroundColor: color.sage, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.green, alignItems: 'center', justifyContent: 'center', gap: 4 },
  addText: { fontSize: 14, fontWeight: '600', color: color.green },
  error: { color: color.danger, fontSize: 14 },
});
