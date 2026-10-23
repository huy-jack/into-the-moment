'use client';

import { useState, type FormEvent } from 'react';
import { ApiError, enterCode } from '@/src/ui/api';
import { Hero } from './Hero';
import { Head, Icon } from './parts';
import { Mark } from './Logo';
import s from './flow.module.css';

export function Gate({ onOpen }: { onOpen: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await enterCode(code);
      onOpen();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head intro />
      <main className={s.gateMain}>
        <h1 className={s.srOnly}>Put yourself into any moment</h1>
        <Hero size="full">
          <form className={s.codeForm} onSubmit={submit}>
            <label htmlFor="code">Access code</label>
            <div className={s.codeRow}>
              <input
                id="code"
                name="code"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? 'code-error' : 'code-help'}
                required
              />
              <button className={s.btn} type="submit" disabled={busy || !code.trim()}>
                {busy ? 'Checking' : 'Open'}{' '}
                {busy ? (
                  <span className={s.chipMark}>
                    <Mark size={24} mode="loading" />
                  </span>
                ) : (
                  <Icon name="arrow" />
                )}
              </button>
            </div>
            {error ? (
              <p id="code-error" className={s.codeError} role="alert">
                {error}
              </p>
            ) : (
              <p id="code-help" className={s.codeHelp}>
                The code is in the email you got with this link.
              </p>
            )}
          </form>
        </Hero>
      </main>
    </>
  );
}
