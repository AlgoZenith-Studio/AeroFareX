# app/econometrics

The statistical core:

  jevons.py            Elementary aggregation (geometric mean) per route-window cell
  laspeyres.py         Chained DGCA-weighted Laspeyres index computation
  booking_curve.py     Offer-to-transaction correction (T+1..T+45 empirical weights)
  hedonic.py           Quality-adjustment regression (model h-1.2)
  attribution.py       Movement waterfall decomposition with reconciliation assertion
  outliers.py          1.5x IQR cleaning pipeline + imputation rules
  surge.py             3.5x MAD surge-alert detection (distinct from the outlier filter)
