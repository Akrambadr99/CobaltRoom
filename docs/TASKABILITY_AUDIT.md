# GridLoom taskability audit

## Workflow audit

Telemetry investigation separates current input from deferred query state. Dispatch combines asset state, reserve, power, duration, and rollback. Outage response combines filtered selection, site changes, and partial eligibility. Forecast and tariff workflows use fixed time windows, mappings, and refreshed cursors. Stable meter, battery, reading, outage, actor, and clock fixtures keep expected patches within 1–4 files. Static energy cards are weak; replacing telemetry storage or building a forecasting engine is too broad.

## 30 classified directions

1. **Strong candidate · Medium:** deferred telemetry query exposes refreshing then final results.
2. **Strong candidate · Medium-Hard:** older search completion cannot replace newer input results.
3. **Strong candidate · Medium:** source and text filters combine without mutating readings.
4. **Strong candidate · Medium:** empty-result transition restores results when one filter clears.
5. **Strong candidate · Medium-Hard:** dispatch preview recalculates reserve after refreshed battery state.
6. **Strong candidate · Medium-Hard:** optimistic dispatch rolls back while preserving the selected battery.
7. **Strong candidate · Medium:** battery-scoped drafts survive asset switches.
8. **Strong candidate · Medium-Hard:** filtered outage selection produces eligible and skipped restoration groups.
9. **Strong candidate · Medium:** removed outages alone are pruned from selection.
10. **Strong candidate · Medium-Hard:** delayed outage result stays with the originating site after navigation.
11. **Strong candidate · Medium:** corrected readings retain original audit lineage.
12. **Strong candidate · Medium:** tariff cursor recovers after insertion before the current page.
13. **Strong candidate · Medium:** forecast import errors remain mapped to source rows.
14. **Strong candidate · Medium-Hard:** cross-tab reading refresh preserves tab-local filters and draft correction.
15. **Strong candidate · Medium:** permission change during dispatch updates effective actions visibly.
16. **Strong candidate · Medium:** recurring forecast window edits preserve completed periods.
17. **Strong candidate · Medium:** webhook retry becomes terminal and idempotent after success.
18. **Strong candidate · Medium:** notification snooze expires with fixed time.
19. **Medium:** meter-specific saved investigation views.
20. **Medium:** comment mentions on outage timelines.
21. **Medium:** evidence attachment validation.
22. **Medium:** activity filters with cursor pagination.
23. **Poor hidden-test candidate:** real network latency visualization.
24. **Poor hidden-test candidate:** locale-dependent energy chart labels.
25. **Too Easy:** change kWh copy.
26. **Too Easy:** hide one source option.
27. **Too Easy:** recolor an outage badge.
28. **Too Hard:** replace interval storage.
29. **Too Hard:** build a forecasting engine.
30. **Too Hard:** orchestrate live grid-control services.

Strong count: **18** Medium/Medium-Hard directions with deterministic data and distinct temporal-energy behavior.

## Depth expansion directions 31–40

31. **Strong candidate · Medium-Hard:** dispatch envelope combines site, battery, inverter, reserve, mode, and duration. 32. **Strong candidate · Medium:** charge/discharge switches recompute projected SOC. 33. **Strong candidate · Medium-Hard:** refreshed battery SOC invalidates a staged dispatch. 34. **Strong candidate · Medium:** switching batteries keeps numeric inputs while changing policy output. 35. **Strong candidate · Medium-Hard:** fault transition blocks an otherwise valid envelope. 36. **Strong candidate · Medium:** inverter limit and reserve failures remain separately visible. 37. **Strong candidate · Medium-Hard:** optimistic activation rolls back to the same envelope inputs. 38. **Strong candidate · Medium:** zero-capacity data avoids invalid numeric output. 39. **Too Easy:** change the projected-charge label. 40. **Too Hard:** connect the envelope directly to a live grid controller.

Expanded strong count: **26**.

## Strongest 15 candidates

Directions **1, 2, 4, 5, 6, 7, 8, 10, 11, 14, 15, 31, 33, 35, and 37** are the final shortlist. Their React judgment is respectively: explicit loading/final transitions; stale async rejection; reversible empty-state filtering; reserve recalculation after refresh; optimistic dispatch rollback; asset-keyed drafts; partial outage planning; result ownership after navigation; immutable correction lineage; cross-tab draft reconciliation; live permission-derived actions; multi-input dispatch constraints; staged-envelope invalidation; fault-driven state revocation; and rollback that preserves operator inputs.
