import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, BookmarkX, LockKeyhole, LogOut, RotateCcw, Search, Trash2 } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { AuthPanel } from '../components/AuthPanel';
import { cityOf } from '../data/fares';
import { paiseToINR } from '../lib/format';
import { useUserAuth } from '../lib/userAuth';
import {
  clearSearches, deleteAllUserData, deleteSearch, listSaved, listSearches, toggleSaved,
  type SavedRoute, type SearchRecord, type StoreLocation,
} from '../lib/userStore';

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const travelDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const routeName = (from: string, to: string) => `${cityOf(from)?.city ?? from} → ${cityOf(to)?.city ?? to}`;

export const AccountPage: React.FC = () => {
  const { ready, user, signOut, deleteAccount } = useUserAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState<SearchRecord[]>([]);
  const [saved, setSaved] = useState<SavedRoute[]>([]);
  const [where, setWhere] = useState<StoreLocation>('cloud');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [h, s] = await Promise.all([listSearches(user.uid), listSaved(user.uid)]);
    setHistory(h.value);
    setSaved(s.value);
    setWhere(h.where);
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);

  const rerun = (r: { from: string; to: string; date?: string }) => {
    const today = new Date().toISOString().slice(0, 10);
    const date = r.date && r.date > today ? r.date : new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
    navigate(`/fares?from=${r.from}&to=${r.to}&date=${date}`);
  };

  const removeAccount = async () => {
    if (!user) return;
    setError(null);
    try {
      await deleteAllUserData(user.uid);
      await deleteAccount();
      navigate('/');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'auth/requires-recent-login'
        ? 'For your security, sign out and sign in again, then delete your account.'
        : 'Couldn’t delete your account. Please try again.');
    }
  };

  // ---------------------------------------------------------------- signed out: sign in here
  if (ready && !user) {
    return (
      <PageShell title="Sign in" showFooter={false}>
        <section className="account-access" aria-labelledby="account-access-title">
          <div className="account-access-layout container">
            <div className="account-access-story">
              <div className="account-access-story-nav">
                <Link className="account-access-back" to="/" onClick={() => window.scrollTo({ top: 0 })}>
                  <ArrowLeft size={16} aria-hidden="true" /> Back to site
                </Link>
                <Link className="account-access-brand" to="/" aria-label="AeroFareX home" onClick={() => window.scrollTo({ top: 0 })}>
                  <img src="/logo_long_v2.svg" alt="AeroFareX" />
                </Link>
              </div>
              <div className="account-access-copy">
                <h1 id="account-access-title">Your searches,<br /><span className="grad">ready when you return.</span></h1>
                <p>Save fare searches and routes in one place.</p>
              </div>
              <p className="account-access-privacy"><LockKeyhole size={15} aria-hidden="true" /> Only you can see your account data.</p>
            </div>

            <div className="account-access-form-area">
              <div className="account-access-form">
                <div className="account-access-form-head">
                  <h2>Your account.</h2>
                  <p>Sign in or create an account to save and find routes.</p>
                </div>
                <AuthPanel initialMode="signin" />
              </div>
            </div>
          </div>
        </section>
      </PageShell>
    );
  }

  const initials = user?.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <PageShell title="Your account">
      <section className="page-hero acct-hero theme-dark" aria-labelledby="acct-title">
        <div className="container">
          <p className="eyebrow">Your account</p>
          {user && (
            <>
              <div className="acct-hero-row">
                {user.photoURL ? <img className="acct-avatar" src={user.photoURL} alt="" /> : <span className="acct-avatar" aria-hidden="true">{initials}</span>}
                <div>
                  <h1 className="page-title" id="acct-title" style={{ marginTop: 0 }}>Hi, {user.name.split(' ')[0]}</h1>
                  <p className="page-sub" style={{ marginTop: 6 }}>
                    {user.email}{user.createdAt && <> · member since {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</>}
                  </p>
                </div>
              </div>
              <dl className="acct-stats">
                <div><dt>Searches</dt><dd className="num">{history.length}</dd></div>
                <div><dt>Saved routes</dt><dd className="num">{saved.length}</dd></div>
                <div>
                  <dt>Cheapest seen</dt>
                  <dd className="num">{history.some((h) => h.cheapestPaise) ? paiseToINR(Math.min(...history.filter((h) => h.cheapestPaise).map((h) => h.cheapestPaise!))) : '–'}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </section>

      <section className="ed band-100" aria-label="Your data">
        <div className="ed-inner acct-grid">
          <div className="acct-box">
            <div className="acct-box-head">
              <h2>Search history</h2>
              <div className="acct-actions">
                <Link to="/fares" className="btn btn-primary btn-sm"><Search size={15} aria-hidden="true" /> New search</Link>
                {history.length > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => void clearSearches(user!.uid).then(refresh)}>
                    <Trash2 size={15} aria-hidden="true" /> Clear all
                  </button>
                )}
              </div>
            </div>
            {history.length === 0 ? (
              <div className="acct-row"><p className="fx-note">No searches yet. Your fare searches will appear here.</p></div>
            ) : history.map((h) => (
              <div className="acct-row" key={h.id}>
                <div>
                  <p className="acct-row-title">{routeName(h.from, h.to)} <span className="fx-note">· {travelDate(h.date)}</span></p>
                  <p className="acct-row-sub">
                    Searched {when(h.at)}{h.cheapestPaise ? <> · cheapest real price then <b>{paiseToINR(h.cheapestPaise)}</b></> : null}
                  </p>
                </div>
                <div className="acct-actions">
                  <button className="acct-icon-btn" onClick={() => rerun(h)} aria-label={`Search ${routeName(h.from, h.to)} again`} title="Search again">
                    <RotateCcw size={15} aria-hidden="true" />
                  </button>
                  <button className="acct-icon-btn" onClick={() => void deleteSearch(user!.uid, h.id).then(refresh)} aria-label="Delete this search" title="Delete">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 'clamp(24px, 3vw, 48px)' }}>
            <div className="acct-box">
              <div className="acct-box-head"><h2>Saved routes</h2></div>
              {saved.length === 0 ? (
                <div className="acct-row"><p className="fx-note">Save a route from its results to check it again quickly.</p></div>
              ) : saved.map((s) => (
                <div className="acct-row" key={s.id}>
                  <button className="acct-row-title" style={{ textAlign: 'left' }} onClick={() => rerun(s)}>
                    {routeName(s.from, s.to)} <ArrowRight size={14} aria-hidden="true" style={{ display: 'inline' }} />
                  </button>
                  <button className="acct-icon-btn" onClick={() => void toggleSaved(user!.uid, s.from, s.to, false).then(refresh)} aria-label="Remove saved route" title="Remove">
                    <BookmarkX size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>

            <div className="acct-box">
              <div className="acct-box-head"><h2>Privacy &amp; account</h2></div>
              <div className="acct-danger">
                <p>
                  {where === 'cloud'
                    ? 'Your history and saved routes are stored in your account, visible only to you.'
                    : 'Your history and saved routes are stored on this device only for now.'}
                </p>
                <button className="btn btn-ghost" onClick={() => void signOut()}><LogOut size={16} aria-hidden="true" /> Sign out</button>
                {!confirmDelete ? (
                  <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} aria-hidden="true" /> Delete account and data</button>
                ) : (
                  <div className="auth-msg" data-kind="error" role="alert">
                    <p><b>Delete everything?</b> This removes your account, search history and saved routes. It can’t be undone.</p>
                    <div className="acct-actions" style={{ marginTop: 10 }}>
                      <button className="btn btn-dark btn-sm" onClick={() => void removeAccount()}>Yes, delete</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                {error && <p className="auth-msg" data-kind="error" role="alert">{error}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
};
