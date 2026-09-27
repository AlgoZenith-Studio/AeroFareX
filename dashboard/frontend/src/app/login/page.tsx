'use client';

import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { DEV_ROLE, LANDING_URL } from '@/lib/config';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match an account.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/missing-email': 'Enter your email first, then choose “Forgot password?”.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
  'auth/network-request-failed': 'Network error. Check your connection.',
  'auth/email-already-in-use': 'That email already has an account. Sign in instead.',
  'auth/weak-password': 'Use a password of at least 8 characters.',
};

const inputBox =
  'flex h-10 items-center gap-2.5 rounded-xl text-sm border border-line-control bg-surface px-3.5 transition-colors focus-within:border-sky-600 focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--sky-500)_22%,transparent)]';

export default function LoginPage() {
  const { status, signInWithEmail, signInWithGoogle, signUp, resetPassword, signInDevPreview } = useAuth();
  // 'signup' = request analyst access (the landing site links here with ?mode=signup)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'signup') setMode('signup');
  }, []);
  const signup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof FirebaseError ? MESSAGES[e.code] ?? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = () => {
    if (!email) { setError(MESSAGES['auth/missing-email']); return; }
    void run(async () => {
      await resetPassword(email);
      setNotice(`If ${email} has an account, a reset link is on its way.`);
    });
  };

  return (
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden p-4">
      {/* Page background: sunset cloud deck, lightly dimmed so the card stands out */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: 'url(/long_bg.jpg)' }} />
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'color-mix(in srgb, var(--ink) 35%, transparent)' }} />

      <a
        href={LANDING_URL}
        className="absolute left-4 top-4 inline-flex h-10 items-center gap-2 rounded-full bg-white/90 px-4 text-sm font-bold text-black shadow-e2 backdrop-blur hover:bg-white sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} aria-hidden /> Back to website
      </a>

      <div className="grid w-full max-w-[752px] overflow-hidden rounded-[24px] bg-surface shadow-e3 md:grid-cols-[1.05fr_1fr]">
        {/* ---------------------------------------------------------------- left: photo + brand */}
        <div className="relative isolate flex min-h-[240px] flex-col justify-between p-6 text-white md:min-h-[476px] md:p-6">
          <img src="/mini_img.webp" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-[center_42%] md:object-center" />
          {/* Dark at the top (logo) and bottom (headline), clear through the middle */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background: `linear-gradient(180deg,
                color-mix(in srgb, var(--ink) 70%, transparent) 0%,
                color-mix(in srgb, var(--ink) 10%, transparent) 30%,
                color-mix(in srgb, var(--ink) 15%, transparent) 50%,
                color-mix(in srgb, var(--ink) 90%, transparent) 100%)`,
            }}
          />
          {/* Whitish "jelly" plate, centred on the panel: solid gradient, glossy rim */}
          <div className="glass-plate self-center px-4 py-3">
            <img
              src="/logo-long.png"
              alt="AeroFareX: Real-Time Airfare Price Index for India"
              width={260}
              height={56}
              className="relative h-auto w-[clamp(170px,16vw,210px)]"
            />
          </div>
          <div>
            <p className="font-display text-[clamp(19px,1.9vw,24px)] leading-tight [text-shadow:var(--text-shadow-dark)]">
              The analyst portal for India’s daily airfare index.
            </p>
            <p className="mt-3 hidden max-w-[40ch] text-sm text-white/85 md:block">
              For NSO, RBI and DGCA staff. Access is granted per person by an AeroFareX admin.
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- right: sign in */}
        <div className="flex flex-col px-6 py-5 sm:px-7 sm:py-6">
          <span className="eyebrow">Analyst portal</span>
          <h1 className="mt-2 text-[clamp(24px,2.1vw,28px)] leading-tight">{signup ? 'Request access' : 'Welcome back'}</h1>
          <p className="mt-1.5 text-sm text-text-2">
            {signup
              ? 'For NSO, RBI, DGCA and ministry staff. An admin approves every request.'
              : 'Sign in with your work account to continue.'}
          </p>

          {status === 'unconfigured' ? (
            <div className="mt-6 rounded-xl bg-status-warning/15 p-4 text-sm" role="alert">
              <p className="font-medium">Firebase isn’t configured yet.</p>
              <p className="mt-1 text-text-2">
                Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and fill in the
                <code className="font-mono"> NEXT_PUBLIC_FIREBASE_*</code> values from your Firebase project settings, then restart.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(signInWithGoogle)}
                className="btn btn-outline mt-4 h-10 w-full text-sm justify-center disabled:opacity-60"
              >
                <span className="grid size-5 place-items-center rounded-full border border-line-control text-[11px] font-bold" aria-hidden>G</span>
                {signup ? 'Request with Google' : 'Continue with Google'}
              </button>

              <div className="my-3.5 flex items-center gap-3 text-xs text-text-3">
                <span className="h-px flex-1 bg-line" />{signup ? 'or with your work email' : 'or sign in with email'}<span className="h-px flex-1 bg-line" />
              </div>

              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => (signup ? signUp(name, email, password) : signInWithEmail(email, password)));
                }}
              >
                {signup && (
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Full name
                    <span className={inputBox}>
                      <User size={17} className="text-text-3" aria-hidden />
                      <input
                        required autoComplete="name" placeholder="Your name"
                        value={name} onChange={(e) => setName(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent font-normal outline-none placeholder:text-text-3"
                      />
                    </span>
                  </label>
                )}
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Work email
                  <span className={inputBox}>
                    <Mail size={17} className="text-text-3" aria-hidden />
                    <input
                      type="email" required autoComplete="email" placeholder="name@mospi.gov.in"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent font-normal outline-none placeholder:text-text-3"
                    />
                  </span>
                </label>

                <div className="flex flex-col gap-1.5 text-sm font-medium">
                  <span className="flex items-center justify-between">
                    <label htmlFor="password">{signup ? 'Create a password' : 'Password'}</label>
                    {!signup && (
                      <button type="button" onClick={forgot} className="text-xs font-bold text-sky-800 hover:underline">Forgot password?</button>
                    )}
                  </span>
                  <span className={inputBox}>
                    <Lock size={17} className="text-text-3" aria-hidden />
                    <input
                      id="password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent font-normal outline-none placeholder:text-text-3"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="text-text-3 hover:text-text-1"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </div>

                {error && <p className="rounded-xl bg-status-critical/10 px-3 py-2 text-sm text-status-critical" role="alert">{error}</p>}
                {notice && <p className="rounded-xl bg-status-good/10 px-3 py-2 text-sm text-text-1" role="status">{notice}</p>}

                <button type="submit" disabled={busy} className="btn btn-primary mt-1 h-10 w-full text-sm justify-center disabled:opacity-60">
                  {busy ? 'Please wait…' : signup ? 'Request access' : 'Sign in'} {!busy && <ArrowRight size={17} aria-hidden />}
                </button>
              </form>

              <p className="mt-3 text-center text-xs text-text-2">
                {signup ? 'Already approved? ' : 'New to the portal? '}
                <button
                  type="button"
                  onClick={() => { setMode(signup ? 'signin' : 'signup'); setError(null); setNotice(null); }}
                  className="font-bold text-sky-800 hover:underline"
                >
                  {signup ? 'Sign in' : 'Request access'}
                </button>
              </p>
            </>
          )}

          {DEV_ROLE && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-line-control bg-surface-alt px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-text-2">
                <Sparkles size={15} className="text-sky-800" aria-hidden />
                Local preview · <b className="text-text-1">{DEV_ROLE.toLowerCase()}</b>
              </span>
              <button onClick={signInDevPreview} className="text-sm font-bold text-sky-800 hover:underline">Continue →</button>
            </div>
          )}

          <p className="mt-auto flex items-center gap-2 pt-4 text-[11px] text-text-3">
            <ShieldCheck size={15} className="shrink-0" aria-hidden />
            Role-based access, secured by Firebase Authentication. Need access? Ask your AeroFareX admin.
          </p>
        </div>
      </div>
    </div>
  );
}
