"""
AeroFareX collector (TRD Part A, decisions D6/D7):

  plan      routes × advance windows for today's search date (IST)
  fetch     Scrapy, declared user-agent, robots.txt obeyed, one request at a time per
            domain with a 3.5 s jittered delay, retries          -> orchestrator/
  archive   raw payload gzip -> SHA-256 -> batch hash chain        -> storage/
  parse     adapter.parse(raw) -> ParsedFare (integer paise)       -> adapters/
  validate  components add up · IQR outliers flagged · phantom fares -> pipeline/
  load      raw_observations + fare_observations + fare_components  -> pipeline/
  health    circuit breaker per source, collection_runs, Firestore  -> monitoring/

Entry point: `python -m collector.orchestrator.run --slot 19:00` (the scheduler in
aerofarex-core runs it in a child process at each collection slot).
"""
