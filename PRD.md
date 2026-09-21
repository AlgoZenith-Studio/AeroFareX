# AirFare: Real-time Airfare Price Index for India
## Product Requirements Document (PRD) · Version 2.0
**Programme:** Smart India Hackathon — Ministry of Statistics & Programme Implementation (MoSPI)  
**Primary Beneficiaries:** National Statistical Office (NSO), Reserve Bank of India (RBI), Directorate General of Civil Aviation (DGCA) / Ministry of Civil Aviation (MoCA)  
**Secondary Users:** Economic researchers, macro analysts, financial institutions, general public  
**Product Name:** AirFare  
**Published Indices:**
- **AFI** (Air Fare Index — Headline Base-Fare Index)
- **TCT-AFI** (Total Cost of Travel AirFare Index)
- **ANC-AFI** (Ancillary AirFare Index)

---

## 1. Executive Summary

India measures consumer inflation through the official Consumer Price Index (CPI), published monthly by the National Statistical Office (NSO). Within the CPI basket, the **"Transport and Communication"** sub-group encompasses domestic air travel.

Historically, air travel price quotes have been collected through traditional, offline field surveys: field investigators physically visit a limited roster of ticketing counters once a month to record advertised quotes. This procedure functions adequately for standard retail commodities (such as soap or grain), but it structurally fails when applied to airline seats:
- More than **92% of domestic Indian air tickets** are purchased through digital channels (carrier direct web/mobile portals and Online Travel Aggregators [OTAs]).
- Airline algorithmic revenue management software dynamically alters seat prices dozens of times per day based on real-time load factors, velocity, and time-to-departure.
- Headline advertised base fares exclude mandatory statutory levies, fuel surcharges, convenience charges, and baggage/seat selection fees.

**The Consequence:** The official CPI airfare series suffers from a severe measurement lag, samples the wrong marketplace, under-reports actual consumer out-of-pocket costs by **8% to 15%**, and fails to capture high-frequency dynamic surges.

**The Solution — AirFare:** An automated, sovereign-grade price measurement platform that continuously samples airfares across India's domestic aviation network, unbundles every quote into its granular components, corrects advertised rates into realized transaction prices using empirical booking curves and hedonic quality adjustment, and publishes high-frequency daily indices with end-to-end cryptographic auditability.

---

## 2. Core Vision & The Five Commitments

> *"Everyone else can scrape a fare. AirFare is the only system that converts a scraped advertised price into a statistically valid consumer price, and can prove every published number back to its raw source."*

### The Five Commitments
1. **Daily Frequency Instead of Monthly:** A published index every single day with zero reporting lag, replacing the slow, 30-day manual survey cycle.
2. **Full Out-of-Pocket Cost (TCT-AFI) Instead of Headline Fare:** Isolating convenience fees, user development fees (UDF), passenger service fees (PSF), fuel surcharges (YQ), seat fees, and GST from the base tariff.
3. **What People Pay, Not What Is Quoted:** Converting advertised search-window prices into realized transaction prices via an empirical **Booking-Curve Correction Layer**.
4. **Explainable Movement (Attribution Waterfall):** Every day-on-day index shift is decomposed mathematically into its constituent route, carrier, advance window, fee type, and economic driver (jet fuel vs demand-pull) contributions.
5. **Reproducible & Sovereign by Design:** Every published index figure is anchored to raw, tamper-evident scraper artifacts in append-only storage with chained batch hashes. Any third party or parliamentary auditor can deterministically recompute the index from stored raw data.

---

## 3. The Four Measurement Gaps in Existing Systems

| Gap | The Reality in Airline Ticketing | What Other Trackers Do | What AirFare Implements |
| :--- | :--- | :--- | :--- |
| **Gap 1: Advertised Price $\ne$ Paid Price** | $T+1$ (1 day before departure) fares are typically $2.5\times$ to $4\times$ higher than $T+45$ fares, but are transacted by fewer than 8% of travelers. | Naive scrapers record the front-page search price or lowest quote, massively overstating inflation. | **Offer-to-Transaction Correction:** Weights advance-purchase windows ($\omega_{T+1}, \dots, \omega_{T+45}$) by actual passenger booking velocity calibrated with DGCA empirical distributions. |
| **Gap 2: Shifting Product Quality** | Airlines unbundle services (e.g., stripping free checked baggage, converting standard seats to paid, altering cancellation penalties). | Treat changes in fare family attributes as pure price inflation. | **Hedonic Quality Adjustment:** Decomposes seat attribute bundles (baggage, refundability, time of day) via regression to isolate pure price change. |
| **Gap 3: Inflation Shifted into Ancillaries** | Low-cost carriers keep headline base tariffs artificially flat while sharply increasing seat fees, meal fees, and mandatory OTA platform fees. | Commercial trackers only monitor top-level base fares. | **Parallel Index Triad:** Publishes **AFI** (base), **TCT-AFI** (total travel outlay), and **ANC-AFI** (ancillaries) side-by-side to expose the hidden "drip pricing" inflation wedge. |
| **Gap 4: Lack of Auditability** | Commercial scrapers operate proprietary, closed "black-box" models to upsell price-freeze products or fintech subscriptions. | No data lineage, no raw provenance, impossible for NSO or RBI to verify. | **Cryptographic Provenance Ledger:** Raw payloads hashed (SHA-256) into MinIO/Firebase Storage; immutable TimescaleDB ledger; full observation drill-down drawer. |

---

## 4. Stakeholder Utility

### 4.1 National Statistical Office (MoSPI / NSO)
- **Primary Function:** Consumer Price Index (CPI) production.
- **Direct Impact:** Transitions the "Transport and Communication" sub-index from obsolete counter surveying to an auditable, daily time-series ready for state-level and national CPI integration.

### 4.2 Reserve Bank of India (RBI)
- **Primary Function:** Monetary policy formulation and inflation targeting.
- **Direct Impact:** Captures high-frequency demand-pull and energy cost-push inflationary pressures in real-time, eliminating the 45-day official reporting lag.

### 4.3 Directorate General of Civil Aviation (DGCA) & MoCA
- **Primary Function:** Tariff oversight and consumer protection.
- **Direct Impact:** Real-time visibility into predatory surge pricing during extreme weather disruptions, operational cancellations, and festival peaks (e.g., Diwali, Chhath Puja).

### 4.4 Researchers, Media & General Public
- **Primary Function:** Macroeconomic analysis and transparent airfare tracking.
- **Direct Impact:** Transparent access to public methodology, index vintages, and citizen transparency views without commercial ads or booking conflicts of interest.

---

## 5. Scope & Operating Model

### 5.1 System Archetype
* **Sovereign Infrastructure:** Non-commercial public good funded by MoSPI. AirFare has **no products to sell, no affiliate commissions, and no price-freeze upsells**. The sole objective is econometric accuracy and auditability.
* **Ethical Collection Posture:** Rather than running clandestine botnets (an unacceptable liability for a government ministry), AirFare operates as a **declared, transparent collector**:
  - Custom `User-Agent`: `AirFare-StatisticalCollector/2.0 (+https://mospi.gov.in/airfare-collector)`
  - Off-peak execution windows (`01:00` to `04:00` IST and mid-day off-peak)
  - Strict rate-limiting with $3.5\text{s}$ jittered delay and zero concurrent hits per domain
  - Postured as a temporary observation bridge toward formal, statutory carrier API feeds.

### 5.2 Target Data Sourcing Hierarchy
- **Tier-1: Carrier-Direct Portals (75% Weight):**
  - InterGlobe Aviation (IndiGo — ~62% domestic share)
  - Air India Group (Air India & Air India Express)
  - Akasa Air
  - SpiceJet
- **Tier-2: Leading Aggregators (25% Weight):**
  - MakeMyTrip, EaseMyTrip, Ixigo (specifically to measure the mandatory convenience fee wedge and interline connections).

### 5.3 Representative Route Basket (Top 5 DGCA Trunk Sectors)
1. **DEL – BOM** (Delhi – Mumbai | Primary Metro Trunk | 12.4% Pax Share)
2. **DEL – BLR** (Delhi – Bengaluru | Tech Corridor / Trunk | 9.8% Pax Share)
3. **BOM – BLR** (Mumbai – Bengaluru | Inter-Metro High Density | 7.6% Pax Share)
4. **DEL – CCU** (Delhi – Kolkata | East Metro Trunk | 5.2% Pax Share)
5. **BLR – HYD** (Bengaluru – Hyderabad | Regional Short-Haul | 4.3% Pax Share)

---

## 6. Published Indices & Outputs

### 6.1 The Published Index Suite
1. **AFI (Air Fare Index — Headline):** The official successor to current CPI counter quotes, tracking pure quality-adjusted base fare inflation.
2. **TCT-AFI (Total Cost of Travel Index):** Captures the full wallet impact:
   $$\text{Total Fare} = \text{Base} + \text{Fuel Surcharge (YQ)} + \text{Airport Fees (UDF/PSF)} + \text{GST} + \text{Mandatory Platform Fees} + \text{Ancillaries}$$
3. **ANC-AFI (Ancillary Price Index):** Tracks changes in unbundled checked baggage, seat selection, and meal fees.
4. **State-Level Sub-Indices:** Route prices mapped to origin states (e.g., Delhi, Maharashtra, Karnataka, West Bengal, Telangana) for state-level CPI integration.
5. **Seasonally Adjusted Series:** Underlying trend series with recurring festival and wedding spikes filtered out via X-13ARIMA-SEATS methodology.
6. **DGCA Surge Alerts:** Real-time triggers when a route-window fare exceeds $3.5\times \text{MAD}$ above its 14-day rolling seasonal baseline.

---

## 7. Feature Roadmap & Tiering

### Tier 1 — Committed for Demonstration (MVP)
- Automated daily scheduled fare collection across 5 routes, 5 carriers, and 5 booking horizons ($T+1, T+7, T+15, T+30, T+45$).
- Complete fare decomposition (Base, Fuel, Statutory Taxes, Convenience Fees).
- Outlier filtering ($1.5 \times \text{IQR}$) and imputation engine (Cross-source, Cell-mean, 3-day Carry-forward cap).
- Offer-to-transaction correction and chained Laspeyres index calculation.
- Dual-index publication: **AFI** vs **TCT-AFI** with headline gap tracking.
- Day-on-day Movement Attribution Waterfall (reconciled across route, carrier, window, driver).
- Full auditability drawer exposing raw SHA-256 payload hashes and adapter versions.
- Role-gated dashboard (Public, Viewer, Analyst, Admin) powered by Firebase Auth.
- Accessible chart toggles with tabular `DataTable` alternatives and zero dual-axis charts.

### Tier 2 — Built If Time Permits
- Standalone **ANC-AFI** interactive series.
- Jet fuel (ATF) cost passthrough econometric decomposition.
- 7-to-14-day leading inflation nowcast with confidence intervals for RBI.
- Citizen-facing public transparency comparison page.

### Tier 3 — Long-Term National Infrastructure
- Expansion from 5 routes to all 120+ domestic commercial sectors including RCS-UDAN routes.
- Cross-modal price competition tracking (airfares vs Rajdhani / Vande Bharat dynamic rail fares).
- Outbound international short-haul route index (Gulf & Southeast Asia corridors).
- Transition from web observation to direct carrier data-sharing API agreements under MoCA authority.

---

## 8. Success Criteria & Demonstration Checklist

| # | Criterion | Verification Method |
| :--- | :--- | :--- |
| 1 | Continuous daily index generated unattended | 30 consecutive days of automated data published |
| 2 | Statistical agreement with official DGCA data | Pearson $R^2 \ge 0.88$ against historical DGCA monthly route averages |
| 3 | Quantified Drip-Pricing Gap | Measurable spread between TCT-AFI and AFI displayed numerically in the Hero value |
| 4 | Independent Reproducibility | Live recomputation test regenerating a past date's index from stored raw database records |
| 5 | Movement Attribution Reconciliation | Live attribution breakdown where $\sum \text{contributions} \equiv \Delta \text{Total Movement}$ |
| 6 | Full Transparency of Uncertainty | Quality badges, coverage ratios, and imputation percentages displayed on the face of every card |
| 7 | Zero Silent Zeroes or Hidden Gaps | Missing cells, low-confidence cells, and simulated records clearly marked with 45° hatching |
