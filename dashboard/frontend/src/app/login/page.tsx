'use client';

import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import clsx from 'clsx';
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
  'flex h-[42px] items-center gap-3 rounded-[14px] border-0 bg-[#f0f4f5] px-3.5 text-sm font-medium text-[#04282e] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)] transition-all focus-within:bg-[#e4f1f5]';

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
    <div className="relative isolate grid min-h-screen place-items-center overflow-hidden p-4 sm:p-6 md:p-8 select-none">
      {/* Page background: sunset cloud deck, lightly dimmed so the card stands out */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: 'url(/long_bg.jpg)' }} />
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'color-mix(in srgb, var(--ink) 35%, transparent)' }} />

      <a
        href={LANDING_URL}
        className="absolute left-4 top-4 inline-flex h-10 items-center gap-2 rounded-full bg-white/90 px-4 text-xs sm:text-sm font-bold text-black shadow-md backdrop-blur hover:bg-white transition-all sm:left-6 sm:top-6 md:left-8 md:top-8"
      >
        <ArrowLeft size={16} aria-hidden /> Back to website
      </a>

      <div className="grid w-full max-w-[1020px] min-h-[680px] overflow-hidden rounded-[32px] bg-white text-slate-900 shadow-2xl border border-slate-200/80 md:grid-cols-[1fr_1.05fr]">
        {/* ---------------------------------------------------------------- left: photo + brand */}
        <div className="relative isolate flex min-h-[260px] flex-col justify-between p-7 text-white md:min-h-[680px] md:p-10">
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
          <div className="glass-plate self-center px-6 py-4 shadow-xl">
            <img
              src="/logo-long.png"
              alt="AeroFareX: Real-Time Airfare Price Index for India"
              width={260}
              height={56}
              className="relative h-auto w-[clamp(190px,18vw,240px)]"
            />
          </div>
          <div>
            <p className="font-display text-[clamp(21px,2.1vw,27px)] font-bold leading-tight [text-shadow:var(--text-shadow-dark)]">
              The analyst portal for India’s daily airfare index.
            </p>
            <p className="mt-3 hidden max-w-[42ch] text-sm text-white/85 leading-relaxed md:block">
              For NSO, RBI and DGCA staff. Access is granted per person by an AeroFareX admin.
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- right: sign in */}
        <div className="flex min-h-[680px] flex-col justify-between px-7 py-7 sm:px-9 sm:py-9 md:px-10 md:py-10">
          <div className="w-full max-w-[390px] mx-auto flex flex-col">
            <span className="eyebrow text-xs tracking-widest">Analyst portal</span>
            <h1 className="mt-1 font-display text-[clamp(26px,2.4vw,32px)] font-bold leading-tight text-text-1">
              {signup ? 'Request access' : 'Welcome back'}
            </h1>
            <p className="mt-1 min-h-[40px] text-sm text-text-2 leading-relaxed">
              {signup
                ? 'For NSO, RBI, DGCA and ministry staff. An admin approves every request.'
                : 'Sign in with your work account to continue.'}
            </p>

            {/* Mode Switcher Pill Tabs */}
            <div className="mt-4 flex w-full rounded-full bg-[#eef4f6] p-1 shadow-[inset_0_1px_3px_rgba(4,40,46,0.13)]">
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setNotice(null); }}
                className={clsx(
                  'flex-1 h-[42px] rounded-full py-2 px-3 text-base sm:text-lg font-bold transition-all cursor-pointer text-center flex items-center justify-center',
                  !signup
                    ? 'bg-[#04282e] text-white shadow-[0_2px_7px_rgba(4,40,46,0.25)]'
                    : 'text-[#04282e] hover:opacity-80'
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setNotice(null); }}
                className={clsx(
                  'flex-1 h-[42px] rounded-full py-2 px-3 text-base sm:text-lg font-bold transition-all cursor-pointer text-center flex items-center justify-center',
                  signup
                    ? 'bg-[#04282e] text-white shadow-[0_2px_7px_rgba(4,40,46,0.25)]'
                    : 'text-[#04282e] hover:opacity-80'
                )}
              >
                Request access
              </button>
            </div>

            {status === 'unconfigured' ? (
              <div className="mt-6 rounded-2xl bg-status-warning/15 p-4 sm:p-5 text-sm" role="alert">
                <p className="font-bold text-text-1">Firebase isn’t configured yet.</p>
                <p className="mt-1 text-text-2 leading-relaxed">
                  Copy <code className="font-mono">.env.example</code> to <code className="font-mono">.env.local</code> and fill in the
                  <code className="font-mono"> NEXT_PUBLIC_FIREBASE_*</code> values from your Firebase project settings, then restart.
                </p>
              </div>
            ) : (
              <>
                {/* Google OAuth Button */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(signInWithGoogle)}
                  className="btn mt-2.5 h-[42px] w-full justify-center rounded-full bg-[#e6f6fc] hover:bg-[#d5f0fa] text-[#04282e] font-bold border-0 shadow-none transition-all disabled:opacity-60 cursor-pointer text-base sm:text-lg gap-2.5"
                >
                  <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  {signup ? 'Request with Google' : 'Continue with Google'}
                </button>

                <p className="my-2.5 text-center text-xs font-medium text-text-3">
                  {signup ? 'or with your work email' : 'or sign in with email'}
                </p>

              <form
                className="flex flex-col gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() => (signup ? signUp(name, email, password) : signInWithEmail(email, password)));
                }}
              >
                {signup && (
                  <label className="flex flex-col gap-1 text-xs sm:text-sm font-bold text-text-1">
                    Full name
                    <span className={inputBox}>
                      <User size={17} className="text-text-3 shrink-0" aria-hidden />
                      <input
                        required autoComplete="name" placeholder="Your name"
                        value={name} onChange={(e) => setName(e.target.value)}
                        className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-text-3 text-sm sm:text-base text-text-1"
                      />
                    </span>
                  </label>
                )}
                <label className="flex flex-col gap-1 text-xs sm:text-sm font-bold text-text-1">
                  Work email
                  <span className={inputBox}>
                    <Mail size={17} className="text-text-3 shrink-0" aria-hidden />
                    <input
                      type="email" required autoComplete="email" placeholder="name@mospi.gov.in"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-text-3 text-sm sm:text-base text-text-1"
                    />
                  </span>
                </label>

                <div className="flex flex-col gap-1 text-xs sm:text-sm font-bold text-text-1">
                  <span className="flex items-center justify-between">
                    <label htmlFor="password">{signup ? 'Create a password' : 'Password'}</label>
                    {!signup && (
                      <button type="button" onClick={forgot} className="text-xs font-bold text-sky-700 hover:underline cursor-pointer">Forgot password?</button>
                    )}
                  </span>
                  <span className={inputBox}>
                    <Lock size={17} className="text-text-3 shrink-0" aria-hidden />
                    <input
                      id="password" type={showPassword ? 'text' : 'password'} required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-text-3 text-sm sm:text-base text-text-1"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="text-text-3 hover:text-text-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </span>
                </div>

                {error && <p className="rounded-xl bg-status-critical/10 px-3.5 py-2.5 text-xs sm:text-sm text-status-critical font-medium" role="alert">{error}</p>}
                {notice && <p className="rounded-xl bg-status-good/10 px-3.5 py-2.5 text-xs sm:text-sm text-text-1 font-medium" role="status">{notice}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="btn mt-2 h-[44px] w-full justify-center rounded-full bg-[#00c8ff] hover:bg-[#00b5e8] text-[#04282e] font-bold text-sm sm:text-base shadow-[0_4px_16px_rgba(0,200,255,0.35)] gap-2 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {busy ? 'Please wait…' : signup ? 'Request access' : 'Sign in'} {!busy && <ArrowRight size={18} aria-hidden />}
                </button>
              </form>

              <p className="mt-3.5 text-center text-xs sm:text-sm text-text-2">
                {signup ? 'Already approved? ' : 'New to the portal? '}
                <button
                  type="button"
                  onClick={() => { setMode(signup ? 'signin' : 'signup'); setError(null); setNotice(null); }}
                  className="font-bold text-sky-800 hover:underline cursor-pointer"
                >
                  {signup ? 'Sign in' : 'Request access'}
                </button>
              </p>
            </>
          )}

          {DEV_ROLE && (
            <div className="mt-3.5 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-sky-400/40 bg-sky-50/50 px-4 py-2.5 shadow-2xs">
              <span className="flex items-center gap-2 text-xs sm:text-sm text-text-2">
                <Sparkles size={16} className="text-sky-600 fill-sky-600/20" aria-hidden />
                Local preview · <b className="font-bold text-text-1">{DEV_ROLE.toLowerCase()}</b>
              </span>
              <button onClick={signInDevPreview} className="text-xs sm:text-sm font-bold text-sky-800 hover:underline cursor-pointer inline-flex items-center gap-1">
                Continue <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        <p className="mt-auto flex items-start gap-2.5 pt-4 text-xs leading-relaxed text-text-3 w-full max-w-[390px] mx-auto">
          <ShieldCheck size={16} className="shrink-0 text-sky-600 mt-0.5" aria-hidden />
          <span>Role-based access, secured by Firebase Authentication. Need access? Ask your AeroFareX admin.</span>
        </p>
      </div>
      </div>
    </div>
  );
}


