import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, payoutKeys, unwrap, useApi, useBanks, useEarnings, usePayoutAccount, type Earnings, type PayoutAccount } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Icon } from '@/components/icon';
import { Button, FieldLabel, FormError, IconButton, Input, ListLoading, Pill, Reassurance, SelectField, ui } from '@/components/ui';
import { formatDate, formatNaira } from '@/lib/format';
import { color, gutter, radius, space, type } from '@/theme';

/**
 * Payouts (FIN03, FIN04): what the seller has earned by where the money is ("waiting for release"
 * is not "paid"), the bank account WHY ME pays into, and the payouts so far. The account must be
 * in the seller's own name: the bank confirms the name, a code sent to the phone confirms it is
 * them, and after a change payouts wait a while (the seller is told by SMS).
 */
export default function PayoutsScreen() {
  const { t } = useTranslation(['seller', 'common']);
  const earnings = useEarnings();
  const account = usePayoutAccount();

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={earnings.isRefetching} onRefresh={() => void Promise.all([earnings.refetch(), account.refetch()])} tintColor={color.green} />}>
        <View style={{ flexDirection: 'row', paddingTop: space.sm }}>
          <IconButton icon="chevronLeft" label={t('common:back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/sell'))} size={44} bordered={false} />
        </View>
        <Text style={type.display} accessibilityRole="header">{t('payouts.title')}</Text>
        <Text style={[type.body, { color: color.muted }]}>{t('payouts.intro')}</Text>

        {earnings.isPending ? <ListLoading /> : earnings.data ? <Totals totals={earnings.data.totals} /> : <FormError message={t('payouts.loadFailed')} />}

        <AccountCard account={account.data ?? null} loading={account.isPending} failed={account.isError} />

        <Reassurance title={t('common:app.sell.keepOnWhyMe')} />

        {earnings.data ? <History payouts={earnings.data.payouts} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Totals({ totals }: { totals: Earnings['totals'] }) {
  const { t } = useTranslation('seller');
  const items = [
    { key: 'awaiting_delivery', value: totals.awaiting_delivery_kobo, hint: true },
    { key: 'on_hold', value: totals.on_hold_kobo, hint: true },
    { key: 'awaiting_release', value: totals.awaiting_release_kobo, hint: true },
    { key: 'being_paid', value: totals.being_paid_kobo, hint: false },
    { key: 'paid', value: totals.paid_kobo, hint: false },
  ];
  return (
    <View style={styles.totals}>
      {items.map((item) => (
        <View key={item.key} style={[styles.total, item.key === 'paid' && styles.totalPaid]} accessible accessibilityLabel={`${t(`payouts.totals.${item.key}`)}: ${formatNaira(item.value)}`}>
          <Text style={styles.totalLabel}>{t(`payouts.totals.${item.key}`)}</Text>
          <Text style={styles.totalValue}>{formatNaira(item.value)}</Text>
          {item.hint ? <Text style={styles.totalHint}>{t(`payouts.totals.${item.key}_hint`)}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function AccountCard({ account, loading, failed }: { account: PayoutAccount | null; loading: boolean; failed: boolean }) {
  const { t, i18n } = useTranslation('seller');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <View style={[ui.card, styles.card]}>
      <Text style={type.heading} accessibilityRole="header">{t('payouts.account')}</Text>
      <Text style={type.small}>{t('payouts.accountIntro')}</Text>
      {loading ? (
        <ListLoading />
      ) : failed ? (
        <FormError message={t('payouts.loadFailed')} />
      ) : (
        <>
          {account && !editing ? (
            <View style={styles.current}>
              <Icon name="shield" size={26} tint={color.green} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.bodyStrong}>{account.account_name}</Text>
                <Text style={type.small}>{t('payouts.endingIn', { bank: account.bank_name, last4: account.account_last4 })}</Text>
              </View>
            </View>
          ) : null}
          {account?.payouts_allowed_from && !editing ? (
            <View style={styles.cooling}>
              <Text style={type.small}>{t('payouts.coolingOff', { date: formatDate(account.payouts_allowed_from, i18n.language) })}</Text>
            </View>
          ) : null}
          {saved && !editing ? <Text style={styles.ok} accessibilityRole="alert">{t('payouts.saved')}</Text> : null}
          {!account && !editing ? <Text style={type.body}>{t('payouts.noAccount')}</Text> : null}
          {editing ? (
            <AccountForm
              current={account}
              onDone={() => {
                setEditing(false);
                setSaved(true);
              }}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <Button label={account ? t('payouts.change') : t('payouts.add')} tone={account ? 'outline' : 'green'} onPress={() => setEditing(true)} />
          )}
        </>
      )}
    </View>
  );
}

/**
 * Bank and 10-digit number → the bank's name for the account → a code to the phone → saved.
 * Changing the bank or the number starts the check again. One request per tap throughout.
 */
function AccountForm({ current, onDone, onCancel }: { current: PayoutAccount | null; onDone: () => void; onCancel: () => void }) {
  const { t } = useTranslation(['seller', 'errors']);
  const api = useApi();
  const queryClient = useQueryClient();
  const banks = useBanks();
  const [bank, setBank] = useState<string | null>(current?.bank_code ?? null);
  const [number, setNumber] = useState('');
  const [name, setName] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'lookup' | 'send' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const working = useRef(false);

  function reset() {
    setName(null);
    setSentTo(null);
    setCode('');
  }

  async function run(step: 'lookup' | 'send' | 'save', work: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(step);
    setError(null);
    try {
      await work();
    } catch (e) {
      const field = e instanceof ApiRequestError ? Object.values(e.body?.fields ?? {})[0]?.[0] : undefined;
      setError(field ?? t(errorKey(e instanceof ApiRequestError ? e.code : 'network_error')));
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  function lookup() {
    const problems: Record<string, string> = {};
    if (!bank) problems.bank = t('payouts.chooseBank');
    if (!/^\d{10}$/.test(number)) problems.number = t('payouts.accountNumberInvalid');
    setFields(problems);
    if (Object.keys(problems).length > 0) return;
    void run('lookup', async () => {
      setName(unwrap(await api.POST('/v1/me/payout-account/lookup', { body: { bank_code: bank!, account_number: number } })).data.account_name);
    });
  }

  function send() {
    void run('send', async () => {
      setSentTo((unwrap(await api.POST('/v1/me/payout-account/code')).data as { sent_to: string }).sent_to);
    });
  }

  function save() {
    if (!/^\d{6}$/.test(code)) {
      setFields({ code: t('payouts.codeInvalid') });
      return;
    }
    setFields({});
    void run('save', async () => {
      const account = unwrap(await api.PUT('/v1/me/payout-account', { body: { bank_code: bank!, account_number: number, code } })).data;
      queryClient.setQueryData(payoutKeys.account, account);
      void queryClient.invalidateQueries({ queryKey: payoutKeys.all });
      onDone();
    });
  }

  return (
    <View style={{ gap: space.sm }}>
      <FormError message={error} />
      <FieldLabel>{t('payouts.bank')}</FieldLabel>
      <SelectField
        value={bank}
        options={(banks.data ?? []).map((b) => ({ value: b.code, label: b.name }))}
        onChange={(value) => {
          setBank(value);
          reset();
        }}
        placeholder={t('payouts.chooseBank')}
        title={t('payouts.bank')}
        searchPlaceholder={t('payouts.chooseBank')}
        disabled={banks.isPending || busy !== null}
        error={fields.bank}
      />
      <FieldLabel>{t('payouts.accountNumber')}</FieldLabel>
      <Input
        value={number}
        onChangeText={(v) => {
          setNumber(v.replace(/\D/g, '').slice(0, 10));
          reset();
        }}
        accessibilityLabel={t('payouts.accountNumber')}
        keyboardType="number-pad"
        maxLength={10}
        autoComplete="off"
        editable={busy === null}
        error={fields.number}
      />
      {name === null ? <Button label={busy === 'lookup' ? t('payouts.checking') : t('payouts.lookup')} tone="outline" busy={busy === 'lookup'} disabled={busy !== null} onPress={lookup} /> : null}

      {name !== null ? (
        <View style={styles.confirmBox}>
          <Text style={type.small}>{t('payouts.nameIs')}</Text>
          <Text style={[type.heading, { fontSize: 20 }]}>{name}</Text>
          <Text style={type.small}>{t('payouts.notYou')}</Text>
          {sentTo === null ? (
            <Button label={busy === 'send' ? t('payouts.sending') : t('payouts.sendCode')} busy={busy === 'send'} disabled={busy !== null} onPress={send} />
          ) : (
            <>
              <Text style={type.small}>{t('payouts.codeSent', { to: sentTo })}</Text>
              <FieldLabel>{t('payouts.code')}</FieldLabel>
              <Input
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                accessibilityLabel={t('payouts.code')}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                error={fields.code}
                onSubmitEditing={save}
              />
              <Button label={busy === 'save' ? t('payouts.saving') : t('payouts.save')} busy={busy === 'save'} disabled={busy !== null} onPress={save} />
            </>
          )}
        </View>
      ) : null}
      <Button label={t('payouts.cancel')} tone="quiet" disabled={busy !== null} onPress={onCancel} />
    </View>
  );
}

function History({ payouts }: { payouts: Earnings['payouts'] }) {
  const { t, i18n } = useTranslation('seller');
  return (
    <View style={{ gap: space.md }}>
      <Text style={type.title} accessibilityRole="header">{t('payouts.history')}</Text>
      {payouts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[type.small, { textAlign: 'center' }]}>{t('payouts.noPayouts')}</Text>
        </View>
      ) : (
        payouts.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/orders/[id]', params: { id: p.order_id } })} style={[ui.card, styles.payout]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={type.bodyStrong}>{t('payouts.order', { number: p.order_number })}</Text>
              <Text style={type.small}>
                {p.paid && p.completed_at ? t('payouts.paidOn', { date: formatDate(p.completed_at, i18n.language), bank: p.bank_name, last4: p.account_last4 }) : t('payouts.endingIn', { bank: p.bank_name, last4: p.account_last4 })}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={[type.price, { fontSize: 17 }]}>{formatNaira(p.amount_kobo)}</Text>
              <Pill label={t(`payouts.payoutState.${p.state}`)} tone={p.paid ? 'green' : p.state === 'cancelled' ? 'grey' : 'gold'} />
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.canvas },
  content: { paddingHorizontal: gutter, paddingBottom: space.xxxl, gap: space.lg, maxWidth: 640, width: '100%', alignSelf: 'center' },
  totals: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  total: { flexGrow: 1, flexBasis: '45%', padding: space.md, gap: 2, borderRadius: radius.lg, backgroundColor: color.field },
  totalPaid: { backgroundColor: color.sage },
  totalLabel: { fontSize: 13, fontWeight: '600', color: color.muted },
  totalValue: { fontSize: 20, fontWeight: '800', color: color.forest },
  totalHint: { fontSize: 12, color: color.muted },
  card: { padding: space.lg, gap: space.md },
  current: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: color.sage },
  cooling: { padding: space.md, borderRadius: radius.md, backgroundColor: color.goldSoft },
  confirmBox: { gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: color.sage },
  ok: { color: color.green, fontWeight: '700' },
  empty: { padding: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: color.border },
  payout: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
});
