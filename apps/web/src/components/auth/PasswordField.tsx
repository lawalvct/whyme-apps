'use client';

import { forwardRef, useId, useState, type ComponentPropsWithoutRef } from 'react';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { TextField } from '@/components/ui/field';
import { useT } from '@/lib/i18n';
import styles from './AuthCard.module.css';

/** Uses the same registered input so autofill, password managers and form errors keep working. */
export const PasswordField = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<typeof TextField>>(function PasswordField({ id, ...props }, ref) {
  const { t } = useT('auth');
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  return <div className={styles.passwordField}><TextField {...props} id={inputId} ref={ref} type={visible ? 'text' : 'password'} /><button type="button" aria-label={t(visible ? 'ui.hidePassword' : 'ui.showPassword')} aria-controls={inputId} aria-pressed={visible} disabled={props.disabled} onClick={() => setVisible((value) => !value)}><Icon name={visible ? 'eyeOff' : 'eye'} /></button></div>;
});
