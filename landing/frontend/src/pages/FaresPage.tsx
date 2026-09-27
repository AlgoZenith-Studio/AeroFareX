import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeftRight, Bookmark, BookmarkCheck, Clock, History, MapPin, Search, Sparkles, TrendingDown, X } from 'lucide-react';
import { PageShell } from '../components/PageShell';
import { AuthPanel } from '../components/AuthPanel';
import { CITIES, cityOf, isTracked, POPULAR, searchFares, type City, type SearchResult } from '../data/fares';
import { paiseToINR } from '../lib/format';
import { useUserAuth } from '../lib/userAuth';
import { addSearch, listSaved, listSearches, toggleSaved, type SearchRecord } from '../lib/userStore';
import { GUEST_SEARCHES, guestStatus, recordGuestSearch, startGuestClock } from '../lib/guestGate';

const isoPlus = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const GUEST_RECENT = 'afx-guest-recent';

// ---------------------------------------------------------------- city field with suggestions
interface Pair { from: string; to: string; date?: string }

const CityField: React.FC<{
  id: string;
  label: string;
  value: string;
  onPick: (code: string) => void;
  onPickPair: (p: Pair) => void;
  recent: Pair[];
  exclude?: string;
}> = ({ id, label, value, onPick, onPickPair, recent, exclude }) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const city = cityOf(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = text.trim().toLowerCase();
  const cities = CITIES.filter((c) => c.code !== exclude && (!q || c.city.toLowerCase().includes(q) || c.code.toLowerCase().startsWith(q) || c.airport.toLowerCase().includes(q)));
  const showPairs = !q;
  const items: ({ kind: 'city'; city: City } | { kind: 'pair'; pair: Pair; group: string })[] = [
    ...(showPairs ? recent.slice(0, 3).map((pair) => ({ kind: 'pair' as const, pair, group: 'Your recent searches' })) : []),
    ...(showPairs ? POPULAR.map((pair) => ({ kind: 'pair' as const, pair, group: 'Popular routes' })) : []),
    ...cities.map((c) => ({ kind: 'city' as const, city: c })),
  ];

  const choose = (i: number) => {
    const it = items[i];
    if (!it) return;
    if (it.kind === 'city') onPick(it.city.code); else onPickPair(it.pair);
    setText('');
    setOpen(false);
  };

  let lastGroup = '';
  return (
    <div className="fx-field" ref={box}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        value={open ? text : city ? `${city.city}` : ''}
        placeholder={open ? 'City or airport' : 'City or airport'}
        onFocus={() => { setOpen(true); setText(''); setActive(0); }}
        onChange={(e) => { setText(e.target.value); setActive(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          if (e.key === 'Enter' && open) { e.preventDefault(); choose(active); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      <span className="fx-hint">{city ? `${city.code} · ${city.airport}` : 'Pick a city'}</span>
      {open && items.length > 0 && (
        <div className="fx-suggest" id={`${id}-list`} role="listbox">
          {items.map((it, i) => {
            const group = it.kind === 'city' ? (q ? 'Matching airports' : 'All tracked airports') : it.group;
            const header = group !== lastGroup ? <p className="fx-suggest-group">{group}</p> : null;
            lastGroup = group;
            return (
              <React.Fragment key={`${group}-${i}`}>
                {header}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                >
                  {it.kind === 'city' ? (
                    <>
                      <span className="fx-code">{it.city.code}</span>
                      <span><b>{it.city.city}</b><small>{it.city.airport}</small></span>
                    </>
                  ) : (
                    <>
                      {it.group.startsWith('Your') ? <History size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                      <span>
                        <b>{cityOf(it.pair.from)?.city} → {cityOf(it.pair.to)?.city}</b>
                        <small>{it.pair.from} → {it.pair.to}{it.pair.date ? ` · ${prettyDate(it.pair.date)}` : ''}</small>
                      </span>
                    </>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- results
const Results: React.FC<{ result: SearchResult; saved: boolean; onToggleSave: () => void; canSave: boolean }> = ({
  result, saved, onToggleSave, canSave,
}) => {
  const [openRow, setOpenRow] = useState<string | null>(null);
  const all = result.flights.flatMap((f) => f.offers.map((o) => ({ f, o })));
  const cheapest = all.reduce((a, b) => (b.o.parts.totalPaise < a.o.parts.totalPaise ? b : a));
  const lowestAd = all.reduce((a, b) => (b.o.parts.advertisedPaise < a.o.parts.advertisedPaise ? b : a));
  const avgHidden = Math.round(all.reduce((s, x) => s + (x.o.parts.totalPaise - x.o.parts.advertisedPaise), 0) / all.length);
  const maxWhen = Math.max(...result.byDaysAhead.map((d) => d.cheapestPaise));
  const nearest = result.byDaysAhead.reduce((a, b) => (Math.abs(b.days - result.daysAhead) < Math.abs(a.days - result.daysAhead) ? b : a));
  const best = result.byDaysAhead.reduce((a, b) => (b.cheapestPaise < a.cheapestPaise ? b : a));

  return (
    <section className="ed band-100" aria-labelledby="results-title">
      <div className="ed-inner">
        <div className="fx-results-head">
          <div>
            <p className="ed-label">One-way · economy · 1 adult</p>
            <h2 className="fx-route" id="results-title">{cityOf(result.from)?.city} → {cityOf(result.to)?.city}</h2>
            <p className="fx-meta">
              <span><MapPin size={14} aria-hidden="true" /> {result.from} → {result.to}</span>
              <span>{prettyDate(result.date)} · {result.daysAhead} {result.daysAhead === 1 ? 'day' : 'days'} away</span>
              <span><Clock size={14} aria-hidden="true" /> Prices seen at {new Date(result.seenAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST</span>
            </p>
          </div>
          {canSave && (
            <button className="fx-save" aria-pressed={saved} onClick={onToggleSave}>
              {saved ? <BookmarkCheck size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
              {saved ? 'Saved route' : 'Save route'}
            </button>
          )}
        </div>

        <dl className="fx-stats">
          <div className="fx-stat-hl">
            <dt className="ed-label">Cheapest real price</dt>
            <dd className="fx-stat num">{paiseToINR(cheapest.o.parts.totalPaise)}</dd>
            <dd className="fx-note">{cheapest.f.carrier} {cheapest.f.flightNo} on {cheapest.o.platform.name}</dd>
          </div>
          <div>
            <dt className="ed-label">Lowest advertised</dt>
            <dd className="fx-stat num">{paiseToINR(lowestAd.o.parts.advertisedPaise)}</dd>
            <dd className="fx-note">Becomes {paiseToINR(lowestAd.o.parts.totalPaise)} at checkout</dd>
          </div>
          <div>
            <dt className="ed-label">Added at checkout</dt>
            <dd className="fx-stat num">+{paiseToINR(avgHidden)}</dd>
            <dd className="fx-note">Average across all {all.length} prices we found</dd>
          </div>
        </dl>

        <div className="fx-list">
          {result.flights.map((f) => {
            const isBest = f === cheapest.f;
            const adBest = f.offers.reduce((a, b) => (b.parts.advertisedPaise < a.parts.advertisedPaise ? b : a));
            return (
              <article key={f.flightNo} className={`fx-flight${isBest ? ' fx-flight-best' : ''}`}>
                <div className="fx-flight-main">
                  <p className="fx-carrier">
                    <span className="fx-code">{f.carrierCode}</span>
                    <span>{f.carrier} <small>{f.flightNo}</small></span>
                  </p>
                  <p className="fx-times" aria-label={`Departs ${f.depart}, arrives ${f.arrive}, ${f.duration}, non-stop`}>
                    <b>{f.depart}</b>
                    <span className="fx-dur" aria-hidden="true">{f.duration} · non-stop</span>
                    <b>{f.arrive}</b>
                  </p>
                  {(isBest || adBest.platform.id !== f.offers[0].platform.id) && (
                    <div className="fx-badges">
                      {isBest && <span className="fx-badge fx-badge-best"><TrendingDown size={13} aria-hidden="true" /> Cheapest real price</span>}
                      {adBest.platform.id !== f.offers[0].platform.id && (
                        <span className="fx-badge">Lowest ad ({adBest.platform.name}) isn’t the cheapest</span>
                      )}
                    </div>
                  )}
                </div>
                <table className="fx-offers">
                  <caption className="sr-only">{f.carrier} {f.flightNo}: prices by booking site</caption>
                  <colgroup>
                    <col className="c-site" /><col className="c-num c-hide" /><col className="c-num c-hide" /><col className="c-num" /><col className="c-act" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">Where to buy</th>
                      <th scope="col" className="c-hide-cell">Advertised</th>
                      <th scope="col" className="c-hide-cell">Added later</th>
                      <th scope="col">You pay</th>
                      <th scope="col"><span className="sr-only">Details</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.offers.map((o, i) => {
                      const rowId = `${f.flightNo}-${o.platform.id}`;
                      const added = o.parts.totalPaise - o.parts.advertisedPaise;
                      const name = o.platform.kind === 'AIRLINE' ? f.carrier : o.platform.name;
                      return (
                        <React.Fragment key={rowId}>
                          <tr className={i === 0 ? 'fx-cheapest' : undefined}>
                            <th scope="row">
                              <span className="fx-site">
                                <span className="fx-site-name">{name}</span>
                                <span className="fx-kind">{o.platform.kind === 'AIRLINE' ? 'Airline site' : 'Booking site'}</span>
                              </span>
                            </th>
                            <td className="c-hide-cell">{paiseToINR(o.parts.advertisedPaise)}</td>
                            <td className="c-hide-cell fx-hidden">+{paiseToINR(added)}</td>
                            <td className="fx-total">{paiseToINR(o.parts.totalPaise)}</td>
                            <td>
                              <button className="fx-more" onClick={() => setOpenRow(openRow === rowId ? null : rowId)} aria-expanded={openRow === rowId}>
                                {openRow === rowId ? 'Hide' : 'Details'}
                              </button>
                            </td>
                          </tr>
                          {openRow === rowId && (
                            <tr className="fx-breakdown">
                              <td colSpan={5}>
                                <dl>
                                  <div><dt>Base fare</dt><dd>{paiseToINR(o.parts.advertisedPaise)}</dd></div>
                                  <div><dt>Fuel charge</dt><dd>+{paiseToINR(o.parts.fuelPaise)}</dd></div>
                                  <div><dt>Airport fees</dt><dd>+{paiseToINR(o.parts.airportPaise)}</dd></div>
                                  <div><dt>GST</dt><dd>+{paiseToINR(o.parts.gstPaise)}</dd></div>
                                  <div><dt>Platform fee</dt><dd>{o.parts.platformPaise ? `+${paiseToINR(o.parts.platformPaise)}` : 'None'}</dd></div>
                                  <div><dt>You pay</dt><dd>{paiseToINR(o.parts.totalPaise)}</dd></div>
                                </dl>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            );
          })}
        </div>

        <section className="fx-when" aria-labelledby="when-title">
          <div className="fx-when-head">
            <h3 id="when-title">When should you book?</h3>
            <p className="fx-note">
              Cheapest real price on this route, by how far ahead you book.
              {best.days !== nearest.days && <> Booking <b>{best.label.toLowerCase()} ahead</b> costs about <b>{paiseToINR(nearest.cheapestPaise - best.cheapestPaise)} less</b>.</>}
            </p>
          </div>
          <div className="fx-when-grid">
            {result.byDaysAhead.map((d) => (
              <div key={d.days} className="fx-when-cell" data-current={d.days === nearest.days}>
                <p className="ed-label">{d.days === 1 ? 'Tomorrow' : `${d.days} days ahead`}</p>
                <p className="fx-when-v num">{paiseToINR(d.cheapestPaise)}</p>
                <div className="fx-when-bar" aria-hidden="true"><span style={{ width: `${(d.cheapestPaise / maxWhen) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <p className="fx-disclaimer">
          Prices are checked four times a day and may have changed since. AeroFareX doesn’t sell tickets and earns nothing
          from any airline or booking site; book directly wherever the real price suits you. <b>Preview data:</b> these
          prices are sample data until live collection starts.
        </p>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- page
export const FaresPage: React.FC = () => {
  const { user, ready } = useUserAuth();
  const [params, setParams] = useSearchParams();
  const [from, setFrom] = useState(params.get('from') ?? 'DEL');
  const [to, setTo] = useState(params.get('to') ?? 'BOM');
  const [date, setDate] = useState(params.get('date') ?? isoPlus(15));
  const [gateOpen, setGateOpen] = useState(false);
  const [guest, setGuest] = useState(guestStatus());
  const [history, setHistory] = useState<SearchRecord[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [notTracked, setNotTracked] = useState(false);

  const result = useMemo(() => {
    const f = params.get('from');
    const t = params.get('to');
    const d = params.get('date');
    return f && t && d ? searchFares(f, t, d) : null;
  }, [params]);

  // Guest allowance: 5 free searches. The sign-in prompt appears only when a
  // guest tries a 6th search (see runSearch), never on top of their 5th result.
  useEffect(() => {
    if (!ready || user) { setGateOpen(false); return; }
    startGuestClock();
    setGuest(guestStatus());
  }, [ready, user]);

  // Signed-in: load history and saved routes.
  const refresh = useCallback(async () => {
    if (!user) return;
    const [h, s] = await Promise.all([listSearches(user.uid), listSaved(user.uid)]);
    setHistory(h.value);
    setSaved(new Set(s.value.map((x) => x.id)));
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);

  const recent: Pair[] = useMemo(() => {
    if (user) return history.map((h) => ({ from: h.from, to: h.to, date: h.date }));
    try { return JSON.parse(localStorage.getItem(GUEST_RECENT) ?? '[]') as Pair[]; } catch { return []; }
  }, [user, history]);

  const runSearch = async (f = from, t = to, d = date) => {
    if (!isTracked(f, t)) { setNotTracked(true); setParams({}); return; }
    setNotTracked(false);
    if (!user) {
      if (guestStatus().exhausted) { setGateOpen(true); return; }
      recordGuestSearch();
      setGuest(guestStatus());
      try {
        const rows = [{ from: f, to: t, date: d }, ...recent.filter((r) => !(r.from === f && r.to === t))].slice(0, 5);
        localStorage.setItem(GUEST_RECENT, JSON.stringify(rows));
      } catch { /* ignore */ }
    }
    setParams({ from: f, to: t, date: d });
    if (user) {
      const r = searchFares(f, t, d);
      const cheapestPaise = r ? Math.min(...r.flights.map((x) => x.offers[0].parts.totalPaise)) : null;
      await addSearch(user.uid, { from: f, to: t, date: d, at: new Date().toISOString(), cheapestPaise });
      void refresh();
    }
    setTimeout(() => document.getElementById('results-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const pickPair = (p: Pair) => { setFrom(p.from); setTo(p.to); if (p.date && p.date > isoPlus(0)) setDate(p.date); };
  const key = result ? `${result.from}-${result.to}` : '';
  const toggle = async () => {
    if (!user || !result) return;
    const next = !saved.has(key);
    await toggleSaved(user.uid, result.from, result.to, next);
    void refresh();
  };

  return (
    <PageShell title="Search fares">
      <section className="page-hero theme-dark" aria-labelledby="fares-title">
        <div className="container">
          <p className="eyebrow">Fare checker</p>
          <h1 className="page-title" id="fares-title">Find the <span className="grad">real price</span> of your flight</h1>
          <p className="page-sub">
            Compare airlines and booking sites by what you actually pay at checkout, with every fee included.
          </p>

          <form className="fx-search" onSubmit={(e) => { e.preventDefault(); void runSearch(); }} role="search">
            <CityField id="from" label="From" value={from} onPick={setFrom} onPickPair={pickPair} recent={recent} exclude={to} />
            <button type="button" className="fx-swap" aria-label="Swap origin and destination" onClick={() => { setFrom(to); setTo(from); }}>
              <ArrowLeftRight size={18} aria-hidden="true" />
            </button>
            <CityField id="to" label="To" value={to} onPick={setTo} onPickPair={pickPair} recent={recent} exclude={from} />
            <div className="fx-field">
              <label htmlFor="date">Travel date</label>
              <input id="date" type="date" required value={date} min={isoPlus(1)} max={isoPlus(45)} onChange={(e) => setDate(e.target.value)} />
              <span className="fx-hint">Up to 45 days ahead</span>
            </div>
            <button type="submit" className="btn btn-primary fx-go"><Search size={18} aria-hidden="true" /> Search</button>
          </form>

          {ready && !user && (
            <p className="fx-guest">
              <Sparkles size={16} aria-hidden="true" />
              <span>
                <b>{guest.searchesLeft} of {GUEST_SEARCHES}</b> free searches left.
              </span>
              <Link to="/account">Sign in to keep your history</Link>
            </p>
          )}
          {user && (
            <p className="fx-guest">
              <History size={16} aria-hidden="true" />
              <span>Signed in as <b>{user.name}</b>. Your searches are saved to your <Link to="/account">account</Link>.</span>
            </p>
          )}
        </div>
      </section>

      {notTracked && (
        <section className="ed band-100">
          <div className="ed-inner">
            <div className="fx-empty">
              <h3>We don’t track this route yet</h3>
              <p>AeroFareX currently checks India’s five busiest routes, in both directions. More routes are coming. Try one of these:</p>
              <div className="fx-chip-row">
                {POPULAR.map((p) => (
                  <button key={`${p.from}${p.to}`} className="fx-chip" onClick={() => { setFrom(p.from); setTo(p.to); void runSearch(p.from, p.to, date); }}>
                    {cityOf(p.from)?.city} → {cityOf(p.to)?.city}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {result && <Results result={result} saved={saved.has(key)} onToggleSave={() => void toggle()} canSave={Boolean(user)} />}

      {!result && !notTracked && (
        <section className="ed band-100">
          <div className="ed-inner">
            <div className="fx-empty">
              <h3>Where are you flying?</h3>
              <p>Pick a route and a date above, or start from one of India’s busiest routes.</p>
              <div className="fx-chip-row">
                {POPULAR.map((p) => (
                  <button key={`${p.from}${p.to}`} className="fx-chip" onClick={() => { setFrom(p.from); setTo(p.to); void runSearch(p.from, p.to, date); }}>
                    {cityOf(p.from)?.city} → {cityOf(p.to)?.city}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {gateOpen && !user && (
        <div className="fx-overlay" role="dialog" aria-modal="true" aria-labelledby="gate-title">
          <div className="fx-dialog">
            <div className="fx-dialog-head">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <p className="eyebrow">Free account</p>
                <Link to="/" aria-label="Back to home" className="acct-icon-btn"><X size={16} aria-hidden="true" /></Link>
              </div>
              <h2 id="gate-title">Keep searching for free</h2>
              <p>You’ve used your free searches. Create a free account (or sign in) to keep comparing fares and save your history.</p>
            </div>
            <AuthPanel initialMode="signup" />
          </div>
        </div>
      )}
    </PageShell>
  );
};
