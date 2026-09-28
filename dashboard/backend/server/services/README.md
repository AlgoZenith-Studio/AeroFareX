# server/services

`dataset.py` (observations → IndexEngine, cached until the data changes), `publish.py` (compute
and write a day as a new vintage, with the attribution waterfall and an audit event),
`published.py` (read the latest vintage per day, quality metadata), `schedule.py` (IST slot
maths), `scheduler.py` (APScheduler: collection at each slot in a child process, publication
at 20:00 IST).
