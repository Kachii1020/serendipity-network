# Canonical bundle snapshot

This review fixture is produced by `composeBundles` from the checked-in canonical
intent, slots, and travel matrix. `BE-001` and `BE-017` pin the values and verify
byte-stable output over repeated runs.

| Rank | Bundle                                                                            |  Price | End   | Travel |   Score |
| ---: | --------------------------------------------------------------------------------- | -----: | ----- | -----: | ------: |
|    1 | `kiln.beginner-pottery` → `nori.seasonal-counter` → `loop.experimental-listening` | ¥4,500 | 22:00 | 38 min | 60.9444 |
|    2 | `kiln.beginner-pottery` → `nori.seasonal-counter` → `loop.late-experiment`        | ¥4,300 | 22:10 | 38 min | 57.7500 |
|    3 | `kiln.paper-lantern` → `nori.seasonal-counter` → `loop.experimental-listening`    | ¥4,900 | 22:00 | 40 min | 56.8056 |

The winner uses 20- and 18-minute travel legs, leaving 5 and 12 spare minutes.
Its normalized score components are:

```json
{
  "preferenceFit": 1,
  "novelty": 0.88,
  "timeUtilization": 0.62963,
  "discount": 0.4,
  "travelBurden": 0.633333
}
```

Reasons are `MATCHES_PREFERENCES`, `HIGH_NOVELTY`, and `GOOD_VALUE` in fixed
priority order. Bundle IDs are deterministic SHA-256-derived values but are not
duplicated here because callers must treat them as opaque.
