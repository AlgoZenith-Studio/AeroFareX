# pipeline

After fetch, per source:

| Step | Where | Rule |
| :--- | :--- | :--- |
| Parse | `validate.parse_response` | `adapter.parse(raw)`; an exception is recorded as `PARSER_ERROR`, the payload stays archived for a re-parse |
| Failures | `validate.classify_failure` | 401/403/407/429/451 or robots.txt refusal → `BLOCKED`; other errors → `SOURCE_ERROR`; empty answer → `NO_FLIGHT` |
| Add-up | `validate.parse_response` | base + fuel + UDF + PSF + GST + platform fee must equal the total (exact, integer paise) or the quote is `INVALID` |
| Phantom fares | `validate.parse_response` | fewer than 2 seats left → `FLAGGED` |
| Outliers | `validate.flag_outliers` | outside 1.5 × IQR of the route-window cell's log totals → `FLAGGED` (kept, excluded from the index) |
| Load | `load.archive_and_load` | archive payloads, chain the batch hash, insert raw + observations + components in one transaction |

Nothing is deleted or edited afterwards: the tables are append-only.
