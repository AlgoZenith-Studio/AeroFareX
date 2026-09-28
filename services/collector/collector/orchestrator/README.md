# orchestrator

| File | What |
| :--- | :--- |
| `run.py` | One collection run: plan → circuit check → fetch → parse/validate → archive + load → health. `python -m collector.orchestrator.run --slot 19:00`; the scheduler in aerofarex-core runs it in a child process at 02:30 · 05:30 · 13:00 · 19:00 IST |
| `spider.py` | The fetch step (Scrapy). All collection etiquette lives here: declared user-agent, robots.txt obeyed, one request at a time per domain, 3.5 s jittered delay, retries, no cookies/proxies/spoofing |
| `circuit_breaker.py` | HEALTHY → DEGRADED → OPEN → RECOVERING per source. A block (403/429/robots.txt) opens the circuit immediately: stop and seek a data agreement (decision D7) |

The plan is every basket route × advance window (T+1, T+7, T+15, T+30, T+45) for today's
search date in IST. Circuit state is kept in the `source_health` table and pushed to
Firestore `sources/` for the dashboard when a service-account key is present.
