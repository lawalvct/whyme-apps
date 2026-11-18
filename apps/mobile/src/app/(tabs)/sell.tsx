import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, categoryLabel, sellerKeys, unwrap, useApi, useTaxonomy, useTerms, type OwnerListing } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { AppHeader } from '@/components/app-header';
import { Icon } from '@/components/icon';
import { SignedOut } from '@/components/signed-out';
import { Button, EmptyState, FieldLabel, FormError, Input, Pill, Reassurance, Segmented, SelectField, ui } from '@/components/ui';
import { formatNaira, groupDigits, nairaToKobo } from '@/lib/format';
import { updateMe, useAccount } from '@/lib/session';
import { uploadPhoto } from '@/lib/uploads';
import { color, gutter, radius, space, type } from '@/theme';

const MAX_PHOTOS = 5;

type Kind = 'product' | 'service';
type Photo = { key: string; uri: string; asset: ImagePicker.ImagePickerAsset; uploadId?: string; state: 'uploading' | 'done' | 'failed' };

/** Sell: the approved Create listing screen. Photos, details, how buyers get it, then review and publish. */
export default function SellScreen() {
  const { t } = useTranslation(['common', 'seller']);
  const { status, user } = useAccount();
  const [kind, setKind] = useState<Kind>('product');
  const capability = kind === 'product' ? 'vendor' : 'provider';
  const canSell = Boolean(user?.capabilities?.some((c) => c.capability === capability && c.status === 'active'));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {status !== 'signed_in' || !user ? (
          <View style={styles.content}>
            <Text style={type.display}>{t('app.sell.title')}</Text>
            <SignedOut icon="plus" />
          </View>
        ) : !user.phone_verified_at ? (
          <View style={styles.content}>
            <Text style={type.display}>{t('app.sell.title')}</Text>
            <EmptyState icon="shield" title={t('app.sell.phoneNeeded')} />
          </View>
        ) : (
          <ListingForm kind={kind} onKind={setKind} canSell={canSell} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ListingForm({ kind, onKind, canSell }: { kind: Kind; onKind: (kind: Kind) => void; canSell: boolean }) {
  const { t, i18n } = useTranslation(['common', 'seller', 'orders']);
  const api = useApi();
  const queryClient = useQueryClient();
  const taxonomy = useTaxonomy();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [locationId, setLocationId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [fulfilment, setFulfilment] = useState<('pickup' | 'delivery')[]>(['pickup']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<OwnerListing | null>(null);
  const [busy, setBusy] = useState<'draft' | 'review' | 'publish' | null>(null);
  const [reviewing, setReviewing] = useState(false);
  // One tap, one request (project rule): the same key is reused if the first create is retried.
  const createKey = useRef(Crypto.randomUUID());
  const working = useRef(false);

  const categories = (taxonomy.data?.categories ?? [])
    .filter((c) => c.type === kind)
    .map((c) => ({ value: c.id, label: categoryLabel(c, i18n.language) ?? '' }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const locations = (() => {
    const all = taxonomy.data?.locations ?? [];
    const lgas = all.filter((l) => l.type === 'lga').sort((a, b) => a.name.localeCompare(b.name));
    return lgas.flatMap((lga) => [
      { value: lga.id, label: t('seller:wholeLga', { name: lga.name }) },
      ...all.filter((l) => l.type === 'area' && l.parent_id === lga.id).sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: `${a.name}, ${lga.name}` })),
    ]);
  })();

  if (!canSell) return <StartSelling kind={kind} onKind={onKind} />;

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
      const upload = await uploadPhoto(photo.asset, photo.key);
      setPhotos((current) => current.map((p) => (p.key === photo.key ? { ...p, uploadId: upload.id, state: 'done' } : p)));
    } catch {
      setPhotos((current) => current.map((p) => (p.key === photo.key ? { ...p, state: 'failed' } : p)));
    }
  }

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (title.trim().length < 3) found.title = t('seller:titleTooShort');
    if (!categoryId) found.category = t('seller:chooseCategory');
    if (!locationId) found.location = t('seller:chooseLocation');
    if (description.trim().length < 10) found.description = t('seller:descriptionTooShort');
    const kobo = nairaToKobo(price);
    if (kobo !== null && Number.isNaN(kobo)) found.price = t('errors:validation_failed');
    if (kind === 'product' && quantity !== '' && !/^\d+$/.test(quantity)) found.quantity = t('seller:quantityInvalid');
    if (kind === 'product' && fulfilment.length === 0) found.fulfilment = t('app.sell.pickMethod');
    return found;
  }

  /** Creates the draft the first time, then updates it. Returns the saved listing. */
  async function save(withPhotos: boolean): Promise<OwnerListing> {
    const body = {
      kind,
      category_id: categoryId!,
      location_id: locationId!,
      title: title.trim(),
      description: description.trim(),
      price_kobo: nairaToKobo(price),
      quantity: kind === 'product' && quantity !== '' ? Number(quantity) : null,
      fulfilment: kind === 'product' ? fulfilment : null,
      ...(withPhotos ? { photo_ids: photos.filter((p) => p.uploadId).map((p) => p.uploadId!) } : {}),
    };
    // The generated types describe these responses loosely; both return { data: OwnerListing }.
    const response = saved
      ? unwrap(await api.PATCH('/v1/me/listings/{listing}', { params: { path: { listing: saved.id } }, body: { ...body, version: saved.version } as never }))
      : unwrap(await api.POST('/v1/me/listings', { body: { ...body, client_id: createKey.current } as never, headers: { 'Idempotency-Key': createKey.current } }));
    const listing = (response as unknown as { data: OwnerListing }).data;
    setSaved(listing);
    return listing;
  }

  async function run(action: 'draft' | 'review') {
    if (working.current) return;
    setNotice(null);
    setFormError(null);
    const found = validate();
    if (action === 'review' && photos.filter((p) => p.state === 'done').length === 0) found.photos = t('app.sell.photosNeeded');
    if (action === 'review' && photos.some((p) => p.state === 'uploading')) found.photos = t('seller:waitForPhotos');
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    working.current = true;
    setBusy(action);
    try {
      await save(true);
      if (action === 'draft') setNotice(t('app.sell.draftSaved'));
      else setReviewing(true);
    } catch (e) {
      setFormError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  async function publish() {
    if (working.current || !saved) return;
    working.current = true;
    setBusy('publish');
    try {
      unwrap(await api.POST('/v1/me/listings/{listing}/submit', { params: { path: { listing: saved.id } }, body: { version: saved.version } }));
      await queryClient.invalidateQueries({ queryKey: sellerKeys.all });
      setReviewing(false);
      setSaved(null);
      setPhotos([]);
      setTitle('');
      setPrice('');
      setQuantity('');
      setDescription('');
      createKey.current = Crypto.randomUUID();
      setNotice(t('app.sell.published'));
    } catch (e) {
      setReviewing(false);
      setFormError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  const location = locations.find((l) => l.value === locationId)?.label;
  const cover = photos.find((p) => p.state === 'done') ?? photos[0];

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <Text style={[type.display, { flex: 1 }]} accessibilityRole="header">{t('app.sell.title')}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('seller:saveDraft')} disabled={busy !== null} onPress={() => void run('draft')} hitSlop={10}>
            {busy === 'draft' ? <ActivityIndicator color={color.green} /> : <Text style={styles.saveDraft}>{t('seller:saveDraft')}</Text>}
          </Pressable>
        </View>
        <Segmented
          options={[
            { value: 'product', label: t('app.sell.product'), icon: 'bag' },
            { value: 'service', label: t('app.sell.service'), icon: 'tools' },
          ]}
          value={kind}
          onChange={(next) => {
            onKind(next);
            setCategoryId(null);
          }}
        />
        <FormError message={formError} />
        {notice ? (
          <View style={styles.notice} accessibilityRole="alert">
            <Icon name="checkCircle" size={22} tint={color.green} />
            <Text style={[type.bodyStrong, { flex: 1 }]}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.photosHeader}>
          <Text style={[type.title, { fontSize: 22 }]}>{t('seller:photos')}</Text>
          <Text style={type.small}>{t('app.sell.photosCount', { count: photos.length, max: MAX_PHOTOS })}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          {photos.map((photo, i) => (
            <View key={photo.key} style={styles.photo}>
              <Pressable accessibilityRole="button" disabled={photo.state !== 'failed'} onPress={() => void send(photo)} style={StyleSheet.absoluteFill} accessibilityLabel={photo.state === 'failed' ? t('app.sell.uploadFailed') : i === 0 ? t('app.sell.coverPhoto') : t('seller:photoAlt', { number: i + 1 })}>
                <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </Pressable>
              {i === 0 ? <View style={styles.cover} pointerEvents="none"><Pill label={t('seller:cover')} /></View> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={t('app.sell.removePhoto')} onPress={() => setPhotos((current) => current.filter((p) => p.key !== photo.key))} hitSlop={6} style={styles.trash}>
                <Icon name="trash" size={20} tint={color.ink} />
              </Pressable>
              {photo.state !== 'done' ? (
                <View style={styles.photoState} pointerEvents="none">
                  {photo.state === 'uploading' ? <ActivityIndicator color={color.white} /> : <Text style={styles.photoStateText}>{t('app.sell.uploadFailed')}</Text>}
                </View>
              ) : null}
            </View>
          ))}
          {photos.length < MAX_PHOTOS ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('seller:addPhoto')} onPress={() => void addPhotos()} style={({ pressed }) => [styles.photo, styles.addPhoto, pressed && { opacity: 0.8 }]}>
              <Icon name="camera" size={34} tint={color.green} />
              <Text style={styles.addPhotoText}>{t('seller:addPhoto')}</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {errors.photos ? <Text style={styles.error}>{errors.photos}</Text> : null}

        <FieldLabel>{t('seller:listingTitle')}</FieldLabel>
        <Input value={title} accessibilityLabel={t('seller:listingTitle')} onChangeText={setTitle} maxLength={120} placeholder={kind === 'product' ? t('seller:listingTitleHintProduct') : undefined} error={errors.title} />

        <FieldLabel>{t('market:category')}</FieldLabel>
        <SelectField value={categoryId} options={categories} onChange={setCategoryId} placeholder={t('seller:chooseCategory')} title={t('market:category')} error={errors.category} />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <FieldLabel>{kind === 'product' ? t('seller:price') : t('seller:priceService')}</FieldLabel>
            <Input value={price} accessibilityLabel={kind === 'product' ? t('seller:price') : t('seller:priceService')} onChangeText={(v) => setPrice(groupDigits(v))} keyboardType="decimal-pad" placeholder="0" error={errors.price} />
          </View>
          {kind === 'product' ? (
            <View style={{ flex: 1 }}>
              <FieldLabel>{t('seller:quantity')}</FieldLabel>
              <Input value={quantity} accessibilityLabel={t('seller:quantity')} onChangeText={(v) => setQuantity(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="1" error={errors.quantity} />
            </View>
          ) : null}
        </View>

        <FieldLabel>{t('seller:location')}</FieldLabel>
        <SelectField value={locationId} options={locations} onChange={setLocationId} placeholder={t('seller:chooseLocation')} title={t('seller:location')} icon="pin" error={errors.location} />

        <FieldLabel>{t('seller:description')}</FieldLabel>
        <Input value={description} accessibilityLabel={t('seller:description')} onChangeText={setDescription} multiline maxLength={5000} error={errors.description} />

        {kind === 'product' ? (
          <>
            <FieldLabel>{t('seller:fulfilment')}</FieldLabel>
            <View style={styles.twoCol}>
              {(['pickup', 'delivery'] as const).map((method) => {
                const on = fulfilment.includes(method);
                return (
                  <Pressable
                    key={method}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => setFulfilment((current) => (on ? current.filter((m) => m !== method) : [...current, method]))}
                    style={[styles.method, on && styles.methodOn]}>
                    {on ? <Icon name="checkCircle" size={24} tint={color.green} /> : <View style={styles.methodOff} />}
                    <Icon name={method === 'pickup' ? 'shop' : 'truck'} size={26} tint={color.forest} />
                    <Text style={type.bodyStrong}>{method === 'pickup' ? t('market:pickup') : t('market:delivery')}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.fulfilment ? <Text style={styles.error}>{errors.fulfilment}</Text> : null}
          </>
        ) : null}

        <Reassurance title={t('app.sell.keepOnWhyMe')} />
        <Button label={t('app.sell.review')} tone="gold" trailingIcon="arrow" busy={busy === 'review'} disabled={busy !== null} onPress={() => void run('review')} />
      </ScrollView>

      <ReviewSheet
        visible={reviewing}
        onClose={() => setReviewing(false)}
        onPublish={() => void publish()}
        busy={busy === 'publish'}
        cover={cover?.uri}
        title={title}
        price={nairaToKobo(price)}
        kind={kind}
        location={location}
      />
    </>
  );
}

function ReviewSheet({ visible, onClose, onPublish, busy, cover, title, price, kind, location }: {
  visible: boolean;
  onClose: () => void;
  onPublish: () => void;
  busy: boolean;
  cover?: string;
  title: string;
  price: number | null;
  kind: Kind;
  location?: string;
}) {
  const { t } = useTranslation(['common', 'market']);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} accessibilityLabel={t('app.sell.keepEditing')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <Text style={type.title}>{t('app.sell.reviewTitle')}</Text>
        <Text style={type.small}>{t('app.sell.reviewIntro')}</Text>
        <View style={[ui.card, { overflow: 'hidden' }]}>
          {cover ? <Image source={{ uri: cover }} style={{ width: '100%', aspectRatio: 1.6 }} contentFit="cover" /> : null}
          <View style={{ padding: space.md, gap: 2 }}>
            <Text style={type.heading}>{title}</Text>
            <Text style={type.price}>{price != null && !Number.isNaN(price) ? `${kind === 'service' ? `${t('market:searchPriceFrom', { price: '' }).trim()} ` : ''}${formatNaira(price)}` : t('market:priceOnRequest')}</Text>
            {location ? <Text style={type.small}>{location}</Text> : null}
          </View>
        </View>
        <Button label={t('app.sell.publish')} onPress={onPublish} busy={busy} />
        <Button label={t('app.sell.keepEditing')} tone="quiet" onPress={onClose} disabled={busy} />
      </View>
    </Modal>
  );
}

/** Before the first listing of a kind: accept the Seller Terms to turn on selling (ACC07). */
function StartSelling({ kind, onKind }: { kind: Kind; onKind: (kind: Kind) => void }) {
  const { t, i18n } = useTranslation(['common', 'seller']);
  const api = useApi();
  const queryClient = useQueryClient();
  const terms = useTerms('seller', i18n.language);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy || !terms.data) return;
    setBusy(true);
    setError(null);
    try {
      unwrap(await api.POST('/v1/me/capabilities', { body: { capability: kind === 'product' ? 'vendor' : 'provider', terms_version_id: terms.data.id } }));
      const me = unwrap(await api.GET('/v1/me')).data;
      updateMe(queryClient, me);
    } catch (e) {
      setError(t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={type.display}>{t('app.sell.title')}</Text>
      <Segmented
        options={[
          { value: 'product', label: t('app.sell.product'), icon: 'bag' },
          { value: 'service', label: t('app.sell.service'), icon: 'tools' },
        ]}
        value={kind}
        onChange={onKind}
      />
      <View style={[ui.card, { padding: space.lg, gap: space.md }]}>
        <Text style={type.heading}>{t('app.sell.needsSelling')}</Text>
        <Text style={type.small}>{t('app.sell.needsSellingBody')}</Text>
        {terms.data ? (
          <ScrollView style={styles.terms} nestedScrollEnabled>
            <Text style={type.small}>{terms.data.body}</Text>
          </ScrollView>
        ) : null}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((v) => !v)} style={styles.accept}>
          {accepted ? <Icon name="checkCircle" size={24} tint={color.green} /> : <View style={styles.methodOff} />}
          <Text style={[type.bodyStrong, { flex: 1 }]}>{t('app.sell.acceptSellerTerms')}</Text>
        </Pressable>
        <FormError message={error} />
        <Button label={t('app.sell.startSelling')} busy={busy} disabled={!accepted || !terms.data} onPress={() => void start()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  saveDraft: { fontSize: 18, fontWeight: '600', color: color.green },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.sage, borderRadius: radius.md, padding: space.md },
  photosHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  photo: { width: 128, height: 112, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.field },
  cover: { position: 'absolute', top: space.sm, left: space.sm },
  trash: { position: 'absolute', top: space.sm, right: space.sm, width: 34, height: 34, borderRadius: radius.sm, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  photoState: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.sm },
  photoStateText: { color: color.white, fontWeight: '700', textAlign: 'center', fontSize: 13 },
  addPhoto: { backgroundColor: color.sage, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.green, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  addPhotoText: { fontSize: 16, fontWeight: '600', color: color.green },
  twoCol: { flexDirection: 'row', gap: space.md },
  method: { flex: 1, minHeight: 58, borderRadius: radius.lg, backgroundColor: color.field, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  methodOn: { backgroundColor: color.sage },
  methodOff: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color.faint },
  error: { color: color.danger, fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: color.overlay },
  sheet: { backgroundColor: color.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: gutter, gap: space.md },
  terms: { maxHeight: 200, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.md },
  accept: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
});
