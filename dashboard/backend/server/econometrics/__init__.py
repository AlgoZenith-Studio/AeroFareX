"""
The statistical core (TRD Part B). Pure functions over in-memory observations; no I/O.

Every function here is a line-for-line port of the dashboard's executable spec
(dashboard/frontend/src/lib/mock/seed.ts), including the order of floating-point
operations, so the Python engine reproduces the mock's published numbers. The parity
test (tests/test_parity.py) checks that against the TypeScript itself.
"""
