import { useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icon';
import { color, gutter, radius, space, touch, type } from '@/theme';

type ButtonTone = 'green' | 'gold' | 'outline' | 'quiet';

/**
 * One tap, one request: while `busy`, the button is disabled and shows a spinner, so a double
 * tap never sends twice (project rule). `onPress` handlers that send writes also guard with a ref.
 */
export function Button({ label, onPress, tone = 'green', icon, trailingIcon, busy, disabled, style, compact, dense }: {
  label: string;
  onPress?: () => void;
  tone?: ButtonTone;
  icon?: IconName;
  trailingIcon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
  /** Two buttons side by side on a small phone: less padding, slightly smaller text. */
  dense?: boolean;
}) {
  const off = disabled || busy;
  const fg = tone === 'green' ? color.white : tone === 'gold' ? color.forest : color.green;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [styles.button, compact && styles.buttonCompact, dense && styles.buttonDense, toneStyle[tone], pressed && styles.pressed, off && styles.disabled, style]}>
      {busy ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={20} tint={fg} /> : null}
      <Text style={[styles.buttonText, (compact || dense) && styles.buttonTextCompact, dense && { fontSize: 16 }, { color: fg }]} numberOfLines={2}>
        {label}
      </Text>
      {trailingIcon && !busy ? <Icon name={trailingIcon} size={20} tint={fg} /> : null}
    </Pressable>
  );
}

const toneStyle = StyleSheet.create({
  green: { backgroundColor: color.green },
  gold: { backgroundColor: color.goldBright },
  outline: { backgroundColor: color.white, borderWidth: 1.5, borderColor: color.green },
  quiet: { backgroundColor: 'transparent' },
});

/** Square icon button with a border (filters, back). */
export function IconButton({ icon, label, onPress, size = 52, bordered = true }: { icon: IconName; label: string; onPress?: () => void; size?: number; bordered?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size }, bordered && styles.iconButtonBordered, pressed && styles.pressed]}>
      <Icon name={icon} size={24} tint={color.forest} />
    </Pressable>
  );
}

/** Two-option switch, as on Orders (Bought / Sold) and Create listing (Product / Service). */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; icon?: IconName }[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.segmentSelected]}>
            {option.icon ? <Icon name={option.icon} size={24} tint={selected ? color.green : color.forest} /> : null}
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Filter pill: filled green when selected. */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

/** Small status pill on a card ("On the way", "Completed", "Featured"). */
export function Pill({ label, tone = 'gold' }: { label: string; tone?: 'gold' | 'green' | 'grey' | 'red' }) {
  return (
    <View style={[styles.pill, pillTone[tone]]}>
      <Text style={[styles.pillText, tone === 'red' && { color: color.danger }]}>{label}</Text>
    </View>
  );
}

const pillTone = StyleSheet.create({
  gold: { backgroundColor: color.goldBright },
  green: { backgroundColor: color.sageStrong },
  grey: { backgroundColor: color.field },
  red: { backgroundColor: '#FBE9E7' },
});

/** The quiet sage strip with a gold shield: the app's trust message. */
export function Reassurance({ title, body, large }: { title: string; body?: string; large?: boolean }) {
  return (
    <View style={[styles.reassure, large && styles.reassureLarge]}>
      <Icon name="shield" size={large ? 34 : 26} tint={color.gold} />
      <View style={styles.reassureRule} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.reassureTitle, large && styles.reassureTitleLarge]}>{title}</Text>
        {body ? <Text style={type.small}>{body}</Text> : null}
      </View>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={type.title} accessibilityRole="header">{title}</Text>
      {action ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function Input({ error, style, ...props }: TextInputProps & { error?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <TextInput placeholderTextColor={color.faint} style={[styles.input, props.multiline && styles.inputMultiline, error ? styles.inputError : null, style]} {...props} />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
    </View>
  );
}

/** A field that opens a bottom sheet of choices (category, location). */
export function SelectField<T extends string | number>({ value, options, onChange, placeholder, title, icon, error, searchPlaceholder, disabled }: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder: string;
  title: string;
  icon?: IconName;
  error?: string;
  /** Long lists (banks, areas) get a search box at the top of the sheet. */
  searchPlaceholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const close = () => {
    setOpen(false);
    setQuery('');
  };
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: space.xs }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${current?.label ?? placeholder}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => setOpen(true)} style={[styles.input, styles.select, error ? styles.inputError : null, disabled && { opacity: 0.55 }]}>
        {icon ? <Icon name={icon} size={22} tint={color.forest} /> : null}
        <Text style={[type.body, { flex: 1 }, !current && { color: color.faint }]} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <Icon name="chevronDown" size={22} tint={color.forest} />
      </Pressable>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        {/* A fixed share of the screen: a percentage height doesn't resolve for long lists in every renderer. */}
        <View style={styles.sheetFrame}>
        <Pressable style={styles.sheetBackdrop} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight: Math.round(height * 0.75), paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.sheetHandle} />
          <Text style={[type.heading, { paddingHorizontal: gutter, marginBottom: space.sm }]}>{title}</Text>
          {searchPlaceholder ? (
            <View style={{ paddingHorizontal: gutter, marginBottom: space.sm }}>
              <TextInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} placeholderTextColor={color.faint} accessibilityLabel={searchPlaceholder} style={styles.input} autoCorrect={false} />
            </View>
          ) : null}
          <FlatList
            data={shown}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(o) => String(o.value)}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                  style={({ pressed }) => [styles.sheetRow, pressed && { backgroundColor: color.sage }]}>
                  <Text style={[type.body, { flex: 1 }, selected && { color: color.green, fontWeight: '700' }]}>{item.label}</Text>
                  {selected ? <Icon name="check" size={22} tint={color.green} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
        </View>
      </Modal>
    </View>
  );
}

/** What a list shows while its first page loads (a list needs a real element here, not nothing). */
export function ListLoading() {
  return (
    <View style={{ paddingVertical: space.xxxl, alignItems: 'center' }} accessibilityLabel="Loading">
      <ActivityIndicator color={color.green} />
    </View>
  );
}

/** Centered message for empty, signed-out and error states. */
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={30} tint={color.green} />
      </View>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.small, { textAlign: 'center' }]}>{body}</Text> : null}
      {action}
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.formError} accessibilityRole="alert">
      <Text style={{ color: color.danger, fontWeight: '600' }}>{message}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  card: { backgroundColor: color.white, borderWidth: 1, borderColor: color.border, borderRadius: radius.lg },
  divider: { height: 1, backgroundColor: color.border },
});

const styles = StyleSheet.create({
  button: { minHeight: touch + 4, borderRadius: radius.md, paddingHorizontal: space.xl, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonCompact: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill },
  buttonDense: { paddingHorizontal: space.sm, gap: 6 },
  // A long label (Igbo, or an amount) wraps to a second line instead of being cut off.
  buttonText: { fontSize: 18, fontWeight: '700', flexShrink: 1, textAlign: 'center' },
  buttonTextCompact: { fontSize: 15 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  iconButton: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: color.white },
  iconButtonBordered: { borderWidth: 1, borderColor: color.border },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: color.border, borderRadius: radius.lg, padding: 3, backgroundColor: color.white },
  segment: { flex: 1, minHeight: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  segmentSelected: { backgroundColor: color.sageStrong },
  segmentText: { fontSize: 18, fontWeight: '600', color: color.ink },
  segmentTextSelected: { color: color.forest, fontWeight: '700' },
  chip: { minHeight: 40, paddingHorizontal: space.xl, borderRadius: radius.pill, borderWidth: 1, borderColor: color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: color.white },
  chipSelected: { backgroundColor: color.green, borderColor: color.green },
  chipText: { fontSize: 16, color: color.ink, fontWeight: '500' },
  chipTextSelected: { color: color.white, fontWeight: '700' },
  pill: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontSize: 14, fontWeight: '700', color: color.forest },
  reassure: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.sage, borderRadius: radius.lg, paddingHorizontal: space.lg, paddingVertical: space.md, borderWidth: 1, borderColor: '#E1EEE4' },
  reassureLarge: { paddingVertical: space.lg },
  reassureRule: { width: 1.5, alignSelf: 'stretch', backgroundColor: color.forest, opacity: 0.6 },
  reassureTitle: { fontSize: 16, fontWeight: '700', color: color.forest },
  reassureTitleLarge: { fontSize: 20, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  sectionAction: { fontSize: 16, fontWeight: '600', color: color.green },
  fieldLabel: { ...type.label, fontSize: 16, marginTop: space.sm },
  input: { minHeight: 50, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingHorizontal: space.lg, fontSize: 16, color: color.ink, backgroundColor: color.white },
  inputMultiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  inputError: { borderColor: color.danger },
  select: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  error: { color: color.danger, fontSize: 14 },
  sheetBackdrop: { flex: 1, backgroundColor: color.overlay },
  sheetFrame: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: space.sm },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: color.border, marginBottom: space.md },
  sheetRow: { minHeight: touch, paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.border },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: color.sage, alignItems: 'center', justifyContent: 'center' },
  formError: { backgroundColor: '#FBE9E7', borderRadius: radius.md, padding: space.md },
});
