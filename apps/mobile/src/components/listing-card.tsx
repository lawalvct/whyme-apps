import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PublicListing, PublicProfile } from '@whyme/data';
import { Icon } from '@/components/icon';
import { Button, Pill, ui } from '@/components/ui';
import { formatNaira } from '@/lib/format';
import { color, radius, space, type } from '@/theme';
import { mediaUrl } from '@/lib/api';

/** A product or service in a two-column grid: photo, title, green price, location. */
export function ListingCard({ listing, saved, onToggleSave, onPress }: { listing: PublicListing; saved?: boolean; onToggleSave?: () => void; onPress?: () => void }) {
  const { t } = useTranslation(['common', 'market']);
  const photo = listing.photos[0]?.urls.medium;
  const price = listing.price_kobo != null ? `${listing.kind === 'service' ? `${t('market:searchPriceFrom', { price: '' }).trim()} ` : ''}${formatNaira(listing.price_kobo)}` : t('market:priceOnRequest');
  const content = (
    <>
      <View style={styles.photoWrap}>
        {photo ? <Image source={{ uri: mediaUrl(photo) }} style={styles.photo} contentFit="cover" transition={150} /> : <View style={[styles.photo, styles.noPhoto]}><Icon name="image" size={32} tint={color.faint} /></View>}
        {listing.is_featured ? <View style={styles.featured}><Pill label={t('app.featured')} /></View> : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{listing.title}</Text>
        <Text style={type.price} numberOfLines={1}>{price}</Text>
        {listing.location?.name ? (
          <View style={styles.location}>
            <Icon name="pin" size={16} tint={color.muted} />
            <Text style={[type.small, { flex: 1 }]} numberOfLines={1}>{listing.location.name}</Text>
          </View>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[ui.card, styles.card]}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${listing.title}, ${price}`} onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>
          {content}
        </Pressable>
      ) : content}
      {onToggleSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? t('app.saved') : t('app.save')}
          accessibilityState={{ selected: saved }}
          onPress={onToggleSave}
          hitSlop={8}
          style={styles.save}>
          <Icon name={saved ? 'bookmarkFilled' : 'bookmark'} size={22} tint={saved ? color.green : color.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** A shop or service provider: photo, name with a green verified badge, trade and area. */
export function ProviderRow({ profile, onPress }: { profile: PublicProfile; onPress?: () => void }) {
  const { t } = useTranslation();
  const photo = profile.logo?.medium ?? profile.photos[0]?.urls.medium;
  const meta = [profile.category?.name, profile.location?.name].filter(Boolean).join(' · ');
  return (
    <View style={[ui.card, styles.provider]}>
      {photo ? <Image source={{ uri: mediaUrl(photo) }} style={styles.providerPhoto} contentFit="cover" /> : <View style={[styles.providerPhoto, styles.noPhoto]}><Icon name="user" size={30} tint={color.faint} /></View>}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.heading, { flexShrink: 1 }]} numberOfLines={1}>{profile.display_name}</Text>
          {profile.verified ? <View accessibilityLabel={t('app.verified')}><Icon name="verified" size={20} tint={color.green} /></View> : null}
        </View>
        {meta ? <Text style={type.small} numberOfLines={1}>{meta}</Text> : null}
      </View>
      <Button label={t('app.viewProfile')} tone="outline" compact onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, overflow: 'hidden' },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', aspectRatio: 1.45, backgroundColor: color.field },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  featured: { position: 'absolute', top: space.sm, left: space.sm },
  save: { position: 'absolute', top: space.sm, right: space.sm, width: 36, height: 36, borderRadius: radius.sm, backgroundColor: color.white, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.md, gap: 2 },
  title: { ...type.bodyStrong, fontWeight: '500' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  provider: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  providerPhoto: { width: 76, height: 64, borderRadius: radius.md, backgroundColor: color.field },
});
