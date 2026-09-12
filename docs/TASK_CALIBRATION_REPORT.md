# GridLoom task calibration report

GridLoom's strongest task surfaces come from temporal telemetry, dispatch constraints, outage ownership, and deferred queries. The new investigation panel makes current input and deferred results separately visible.

| Workflow group | Why it is medium | React/state concepts | Hidden-test determinism | Likely future patch |
|---|---|---|---|---|
| Telemetry investigation | Query and source filters update on different timelines | deferred values, stale results, memoized views | High | 1–3 existing files |
| Battery dispatch | Reserve, power, duration, and asset state combine | derived validation, optimistic rollback | High | 2–4 files |
| Outage response | Filtered selections and site state can change before execution | keyed selection, partial success, ownership | High | 2–4 files |
| Forecast and tariffs | Time windows, imports, and cursor refreshes create bounded edges | parsing, pagination, fixed clock | High | 1–4 files |

## Calibration

- **Medium majority:** deferred telemetry search; stale query rejection; source plus text filters; corrected-reading audit; battery dispatch preview; optimistic dispatch rollback; filtered outage selection; partial restoration plan; asset-scoped drafts; forecast import conflicts; tariff cursor invalidation; meter saved views; permission changes during dispatch; recurring forecast windows; activity pagination; notification snooze; telemetry attachment validation; webhook delivery retry; comment mention lifecycle; cross-tab refresh preserving local filters.
- **Reject as Too Easy:** change a unit label; hide a filter; add one static badge; alter placeholder text.
- **Reject as Too Hard:** replace interval storage; build a forecasting engine; migrate all energy schemas; orchestrate several external grid services.

The 20 Medium directions above have stable seed readings and bounded time inputs. Expected scope is 1–4 existing files per task.
