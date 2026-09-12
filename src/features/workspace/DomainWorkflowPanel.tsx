/* eslint-disable react-refresh/only-export-components, @typescript-eslint/no-confusing-void-expression */
import { useDeferredValue, useMemo, useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';

export function searchTelemetry(readings: Entity[], query: string, source: string) {
    const term = query.trim().toLocaleLowerCase();
    return readings.filter((item) => (!source || item.fields['source'] === source) && (!term || `${item.title} ${Object.values(item.fields).join(' ')}`.toLocaleLowerCase().includes(term)));
}

export function DomainWorkflowPanel({ snapshot }: { snapshot: Snapshot }) {
    const [query, setQuery] = useState('');
    const [source, setSource] = useState('');
    const deferredQuery = useDeferredValue(query);
    const readings = snapshot.entities.filter((item) => item.kind === 'reading');
    const results = useMemo(() => searchTelemetry(readings, deferredQuery, source), [deferredQuery, readings, source]);
    return <section className="sub" aria-label="Telemetry investigation"><h3>Telemetry investigation <span>{results.length}</span></h3><div className="filters"><input aria-label="Search telemetry" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Meter, source, interval…"/><select aria-label="Telemetry source" value={source} onChange={(event) => setSource(event.target.value)}><option value="">All sources</option>{[...new Set(readings.map((item) => String(item.fields['source'] ?? 'unknown')))].map((item) => <option key={item}>{item}</option>)}</select></div>{query !== deferredQuery && <p role="status" className="notice">Refreshing results…</p>}{results.slice(0, 5).map((item) => <p key={item.id}><b>{item.title}</b><small>{String(item.fields['kwh'] ?? '—')} kWh · {String(item.fields['source'] ?? 'unknown')}</small></p>)}{results.length === 0 && <p className="empty">No telemetry matches both filters.</p>}</section>;
}
