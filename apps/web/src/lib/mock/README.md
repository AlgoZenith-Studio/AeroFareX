# lib/mock

Mock API layer driven by data/seed. Activated via NEXT_PUBLIC_USE_MOCK=true. Must support the same
query parameters and response envelope as the real API, plus the ability to simulate errors and
slow responses so Loading/Error states are testable without a backend.
