# data/seed

30-day realistic seed dataset generator per TRD Part F: 5 routes x 5 windows x multiple sources,
roughly 3,000 observations. First 18 days provenance=SIMULATED, last 12 days provenance=REAL with
an explicit provenance_boundary. Deliberately includes every missing_reason, flagged outliers
(retained, not deleted), and one source in DEGRADED state; seed data must exercise every UI
state, including the ugly ones. Generated output is gitignored; only the generator is committed.
