# server/econometrics

The statistical core (TRD Part B), pure functions with no I/O:

  basket.py      advance windows and the booking curve ω_k (T+1 … T+45)
  jevons.py      elementary aggregation: geometric mean per route-window cell
  engine.py      cells (with carry-forward imputation), Laspeyres index, ANC basket, quality,
                 attribution on five axes (route, carrier, window, component, driver), route
                 aggregates, lead-time cells
  outliers.py    1.5 × IQR screening on log fares (used by the collector)
  jsnum.py       JavaScript number semantics for bit-exact parity with the TS spec

Not built yet: hedonic quality adjustment (§4) and monthly chaining (§1; needs a second month
of live data), MAD surge alerts.
