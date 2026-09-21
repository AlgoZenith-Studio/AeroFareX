# orchestrator

Scheduling, circuit breaker (HEALTHY -> DEGRADED -> OPEN -> RECOVERING), and rate limiting
(3.5s jittered delay, zero concurrent hits per domain). Publishes live health to Cloud Firestore.
