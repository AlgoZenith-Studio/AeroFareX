# pipeline

Sanitization and fare decomposition: outlier filtering (1.5x IQR per route-advance-window cell),
fare unbundling (base + fuel surcharge + UDF/PSF + GST + platform fee + ancillaries), phantom-
ticket filtering (fewer than 2 seats remaining at non-reproducible rates).
