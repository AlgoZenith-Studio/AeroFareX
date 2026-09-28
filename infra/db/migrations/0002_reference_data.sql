-- The index basket (TRD Part B §1): 5 routes, 4 carriers, 5 sources.
-- Pax shares are the DGCA passenger volumes the seed and methodology use
-- (percent of domestic traffic); W_r normalises them over the basket.

INSERT INTO routes (route_id, label, origin, destination, sort_order) VALUES
    ('DEL-BOM', 'Delhi → Mumbai',        'DEL', 'BOM', 1),
    ('DEL-BLR', 'Delhi → Bengaluru',     'DEL', 'BLR', 2),
    ('BOM-BLR', 'Mumbai → Bengaluru',    'BOM', 'BLR', 3),
    ('DEL-CCU', 'Delhi → Kolkata',       'DEL', 'CCU', 4),
    ('BLR-HYD', 'Bengaluru → Hyderabad', 'BLR', 'HYD', 5);

INSERT INTO route_weights (route_id, effective_from, pax_share, source_note) VALUES
    ('DEL-BOM', '2026-01-01', 12.4, 'DGCA domestic traffic share'),
    ('DEL-BLR', '2026-01-01',  9.8, 'DGCA domestic traffic share'),
    ('BOM-BLR', '2026-01-01',  7.6, 'DGCA domestic traffic share'),
    ('DEL-CCU', '2026-01-01',  5.2, 'DGCA domestic traffic share'),
    ('BLR-HYD', '2026-01-01',  4.3, 'DGCA domestic traffic share');

INSERT INTO carriers (carrier_code, label, sort_order) VALUES
    ('6E', 'IndiGo',    1),
    ('AI', 'Air India', 2),
    ('QP', 'Akasa Air', 3),
    ('SG', 'SpiceJet',  4);

INSERT INTO sources (source_id, label, type, carrier_code, fetch_tier, sort_order) VALUES
    ('indigo',     'IndiGo',     'AIRLINE', '6E', 'HTTP',    1),
    ('air_india',  'Air India',  'AIRLINE', 'AI', 'DYNAMIC', 2),
    ('akasa',      'Akasa Air',  'AIRLINE', 'QP', 'HTTP',    3),
    ('spicejet',   'SpiceJet',   'AIRLINE', 'SG', 'BROWSER', 4),
    ('makemytrip', 'MakeMyTrip', 'OTA',     NULL, 'DYNAMIC', 5);
