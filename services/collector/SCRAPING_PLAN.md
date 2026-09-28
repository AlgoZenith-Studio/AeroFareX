# Scraping plan — real fare collection for PS 26056

**Status:** plan, 2026-09-29. Owner: collector stream. Read with [README](./README.md) and
`collector/adapters/sources.py` (setup checklist per source).

## 1. What the PS asks, and the tension in it

PS 26056 asks for automated scraping of airline and OTA portals that "handle[s] JavaScript-rendered
pages, dynamic CAPTCHAs, anti-bot measures, IP rotation, and session management **while remaining
compliant with the robots.txt and terms of service of source websites**, with appropriate
rate-limiting and ethical-scraping safeguards."

Defeating a CAPTCHA or rotating IPs to get past a block is, on almost every one of these sites, a
breach of that same robots.txt/ToS clause. So this plan reads "handle" as **detect, respect and
record**: render JavaScript and keep sessions (fine), let a person clear a CAPTCHA when one appears
(manual mode), and stop and record a block instead of evading it. That is what MoSPI wrote down,
and it is what we can defend in front of MoSPI judges.

**Not in this plan:** automatic CAPTCHA solving (e.g. Scrapling `StealthyFetcher(solve_cloudflare=True)`),
fingerprint spoofing to look like a person, residential/rotating proxies, robots.txt "exemptions".
Why: they circumvent the sites' access controls against their stated terms (legal exposure under
the IT Act 2000 s.43 for unauthorised extraction, and the PS's own compliance clause), and on this
project they would be demonstrated to the ministry that wrote that clause.

## 2. What we found (2026-09-29, requests sent as `AeroFareX-StatisticalCollector/2.0`)

| Source | robots.txt | Flight search allowed for bots? | Notes |
| :--- | :--- | :--- | :--- |
| **Akasa Air** (akasaair.com) | `User-Agent: *` with **no Disallow** | **Yes** (main site) | React SPA: search needs form interaction; the fare XHR host must be checked separately. ToS: "personal and non-commercial use"; no export of site material "except with written permission" → **ask for permission** |
| SpiceJet | `Disallow: /api/v1`, `/public/`, `/externalBooking` | No (fares come from `/api/v1`) | Needs permission |
| Air India Express | `Disallow: /flight-availability` | No | Needs permission |
| EaseMyTrip | `Disallow: /flight-search/listing*` | No | Needs permission |
| Cleartrip | `Disallow: /flights/search*`, `/api/` | No | Needs permission |
| ixigo | `Disallow: /flights/search`, `/api/` | No | Needs permission |
| IndiGo, Air India, MakeMyTrip, Yatra, Goibibo | **Unreadable**: connection times out / is reset for any non-browser client (edge bot protection, likely Akamai) | No | They refuse automated clients outright → data agreement or licensed feed only |

Another team on this PS ([APIx issue #2](https://github.com/SameerKumar05/APIx/issues/2)) reports the
same wall: all 11 portals failed live collection, including the ones where they added stealth
scripts; Akasa returned empty payloads until the search form is driven. Their proposed fix
(residential proxies + robots.txt exemptions) is exactly what §1 rules out.

**Bottom line:** by the sites' own rules, **Akasa Air is the only source we can collect from today**
(pending its written permission). Everything else needs permission or a licensed feed.

## 3. Tools and their roles

| Tool | Role here | Used for |
| :--- | :--- | :--- |
| **Scrapy** (in place) | Orchestration + etiquette: declared UA, robots.txt, 1 request/domain, 3.5 s jitter, retries, circuit breaker | Every source whose fare request replays over plain HTTP |
| **Scrapling `Fetcher`** | Plain HTTP with good parsing and adaptive selectors (survive layout changes) | HTML-only sources inside `parse` |
| **Scrapling `DynamicFetcher`** / **Playwright** | Real Chromium: runs JavaScript, fills the search form, captures the fare XHR | SPAs like Akasa (`fetch_tier = "DYNAMIC"`) |
| **Playwright, headed + `storage_state`** | Manual mode: a person clears a CAPTCHA once; the session is saved and reused | §4 |
| Scrapling `StealthyFetcher` | Not used (automatic anti-bot/Cloudflare bypass; see §1) | — |

Docs: [Scrapling fetchers](https://scrapling.readthedocs.io/en/latest/fetching/choosing.html) ·
[Playwright auth / storage_state](https://playwright.dev/python/docs/auth).

## 4. CAPTCHA handling: the per-source toggle

Setting `CAPTCHA_MODE` per source (`sources` table + dashboard Source health page):

| Mode | When a CAPTCHA / challenge page is detected |
| :--- | :--- |
| `stop` (default) | Record `BLOCKED`, open the circuit, alert. No retry until cooldown or an analyst resets it. |
| `manual` | Pause that source. Open a **headed** browser on the collector machine and alert the operator (dashboard banner + optional email). The operator clears the challenge; Playwright saves `storage_state` (cookies + localStorage) and collection resumes, reusing the session on later runs until it expires. No answer within 10 min → `BLOCKED`, as in `stop`. |

Manual mode never overrides robots.txt: it is only offered for sources whose fare path robots.txt
allows. Detection: challenge markers in the response (Cloudflare/Akamai/hCaptcha/reCAPTCHA
signatures, 403/429 with a challenge body, unexpected redirects to a verification page), handled in
`pipeline/validate.classify_failure`.

Railway runs headless, so manual mode needs the collector on a machine with a screen (a team laptop
or a small VM with VNC) for sources that use it; `stop`-mode sources keep running on Railway.

## 5. Getting real data — three tracks in parallel

**Track A — Akasa Air, now.**
1. DevTools → Network on akasaair.com flight search: record the form flow and the fare XHR (host,
   method, payload, response). Check that host's robots.txt.
2. Email Akasa for written permission (statistical, non-commercial, MoSPI hackathon; rate 1 request /
   3.5 s, 25 queries per run, 4 runs a day). Keep the reply in `docs/permissions/`.
3. Adapter `fetch_tier = "DYNAMIC"`: Playwright fills the form per route × date, captures the XHR JSON,
   `parse` maps it to base fare / fuel / UDF / PSF / GST / total. Save 3–5 responses as fixtures and
   test `parse` on them.
4. Enable in `ENABLED_SOURCES`, run 4×/day. **Every day this starts later is a day of the PS's
   30-day requirement lost.**

**Track B — permission for the rest.** One email per source (template in `docs/permissions/`),
through the SIH/MoSPI mentors where possible: a ministry request carries far more weight than a
student's. Any "yes" becomes an adapter the same week. Log answers in the §2 table.

**Track C — a licensed fare feed (fills coverage legally).** Flight-offer APIs return real, bookable
fares with the tax breakdown: [Amadeus Self-Service Flight Offers Search](https://developers.amadeus.com/),
[Duffel](https://duffel.com/), Indian B2B consolidators (TBO, Tripjack). **To verify before relying on
it:** coverage of IndiGo/Akasa/SpiceJet (Indian LCCs are often thin on GDS feeds), whether free test
tiers return live prices, and licence terms for publishing an index. Add as source type `REFERENCE`.

## 6. Backtest (PS: "30 days back-tested against DGCA monthly average-fare data")

- **DGCA:** no downloadable sector-wise average-fare dataset was found. DGCA's Tariff Monitoring
  Unit checks 78 routes monthly but publishes only summaries in answers to Parliament and press releases.
  DGCA **does** publish monthly city-pair passenger traffic → use it for the route weights `W_r`.
  **Ask the mentors which DGCA fare series they mean**, and get it from them if it's internal.
- **MoSPI CPI (the PS's dataset link):** the official client
  [`mospi-esankhyiki`](https://github.com/nso-india/mospi-esankhyiki) gives item-level CPI. Pull the air
  fare item series as the benchmark.
- **Method for 30 days:** one month of daily AFI/TCT-AFI → monthly mean → compare direction and size
  of change with CPI air-fare (month on month) and with any DGCA route averages for the same month
  (level ratio per route). Report agreement honestly. Don't require 6 months of overlap (the other
  team's backtest failed closed on exactly that).
- Build as `server/services/backtest.py` + `/api/v1/backtest` + a dashboard page.

## 7. Other PS gaps to close

- **Weekly and monthly index** (PS: daily, weekly, monthly): geometric mean of the daily relatives
  over the period, published and stored like daily snapshots (new `frequency` column).
- **Basket:** add Air India Express (`IX`) as a carrier; add MAA-DEL (weights from DGCA traffic).
- **De-duplication:** unique quote per (source, flight, departure, fare family, search slot)
  using the existing `fingerprint`.
- **Lead-time elasticity:** fit ln(fare) against ln(days ahead) per route; the slope is the elasticity.
  Show it next to the fare curve.

## 8. Order of work

| When | What |
| :--- | :--- |
| Day 1–2 | Track A steps 1–3 (Akasa adapter on fixtures); send Track B emails; start Track C research |
| Day 3 | Akasa live 4×/day on Railway or a team machine → the 30-day clock starts |
| Week 1 | `CAPTCHA_MODE` toggle (stop/manual) + challenge detection; weekly/monthly index; de-dup; IX + MAA-DEL |
| Week 2 | Backtest module and page (CPI air fare + DGCA as available); elasticity |
| Ongoing | Each permission "yes" → one adapter; demo shows per-source status: collected / blocked / awaiting permission |

**What to show the judges:** live index from real collected fares (Akasa, plus any permitted
source), the per-source compliance table (who allowed us, who blocked us, and that we stopped),
manual CAPTCHA mode working, the 30-day backtest, and the audit trail from any number back to
the archived raw response.
