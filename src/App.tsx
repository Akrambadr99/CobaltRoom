import { useState, type ReactNode } from 'react'
import { estimatedRuntimeHours } from './telemetry/battery'
import { EnergyFlow } from './telemetry/EnergyFlow'
import { assets, readings as initialReadings, tariffs } from './telemetry/fixtures'
import { forecastVariance } from './telemetry/forecasts'
import { IntervalChart } from './telemetry/IntervalChart'
import { customerMinutesInterrupted, type Outage } from './telemetry/outages'
import { anomalies, rollingConsumption, tariffCost, type Reading } from './telemetry/series'
import { TelemetryHealth } from './telemetry/TelemetryHealth'

type Lens = 'live fabric' | 'history' | 'forecast' | 'reliability' | 'sites'
const outages: Outage[] = [{ id: 'OUT-91', siteId: 'north-feeder', startedAt: '2027-03-15T07:42:00Z', affectedMeters: ['MTR-N1', 'MTR-N2', 'MTR-N3'], cause: 'grid' }]

function App() {
  const [lens, setLens] = useState<Lens>('live fabric')
  const [readings, setReadings] = useState<Reading[]>(initialReadings)
  const [message, setMessage] = useState('')
  const latest = readings.at(-1)!
  const detected = anomalies(readings, 2)
  const rolling = rollingConsumption(readings, latest.at, 1)

  function correctAnomaly() {
    const source = readings.at(-2)!
    setReadings((current) => [...current, { ...source, kwh: 35, source: 'corrected', receivedAt: '2027-03-15T10:20:00.000Z' }])
    setMessage('Correction accepted with operator provenance. The original live sample remains in the ingest log.')
  }

  return <div className="grid-app"><header className="grid-header"><div className="grid-brand"><span>GridLoom</span><small>ENERGY OPERATIONS FABRIC</small></div><div className="site-switch"><span>ACTIVE SITE</span><strong>Riverside Campus⌄</strong></div><div className="carbon"><span>GRID CARBON</span><strong>312 gCO₂/kWh</strong></div></header>
    <nav className="energy-nav" aria-label="Energy lenses">{(['live fabric', 'history', 'forecast', 'reliability', 'sites'] as Lens[]).map((item) => <button key={item} aria-current={lens === item ? 'page' : undefined} onClick={() => { setLens(item) }}>{item}</button>)}</nav>
    <main>{message && <p className="energy-message" role="status">{message}</p>}
      {lens === 'live fabric' && <><EnergyHeading label="LIVE TELEMETRY" title="Energy balance" detail="Source precedence resolves corrected, live, historical, and forecast samples per interval." action={<button onClick={correctAnomaly}>Correct anomaly</button>} /><TelemetryHealth readings={readings} /><EnergyFlow assets={assets} /><div className="energy-layout"><IntervalChart readings={readings} /><aside className="energy-kpis"><Kpi label="Rolling 60 min" value={`${String(rolling)} kWh`} /><Kpi label="Peak interval" value={`${String(Math.max(...readings.map((reading) => reading.kwh)))} kWh`} /><Kpi label="Detected anomalies" value={String(detected.length)} /><Kpi label="Tariff cost" value={`$${tariffCost(readings, tariffs).toFixed(2)}`} /></aside></div></>}
      {lens === 'history' && <><EnergyHeading label="MEASUREMENT RECORD" title="Interval provenance" detail="Corrections supersede display values without erasing the original measurement." /><div className="reading-table"><div className="reading-head"><span>Interval</span><span>Reading</span><span>Source</span><span>Received</span></div>{readings.map((reading) => <div key={`${reading.at}-${reading.source}`}><span>{reading.at.slice(11, 16)}</span><strong>{reading.kwh} kWh</strong><span className={reading.source}>{reading.source}</span><span>{reading.receivedAt.slice(11, 19)}</span></div>)}</div></>}
      {lens === 'forecast' && <><EnergyHeading label="DAY-AHEAD MODEL" title="Generation forecast" detail="Confidence-band misses are evaluated at matching time-series intervals." /><div className="asset-grid">{assets.map((asset) => { const variance = forecastVariance([{ at: asset.name, expectedKwh: asset.forecast, lowerKwh: asset.forecast * .9, upperKwh: asset.forecast * 1.1 }], [{ at: asset.name, actualKwh: asset.output }])[0]; return <article key={asset.name}><span>{asset.status}</span><h2>{asset.name}</h2><strong>{asset.output} kW</strong><p>Forecast {asset.forecast} kW · variance {variance?.varianceKwh ?? 0} kW</p></article> })}</div></>}
      {lens === 'reliability' && <><EnergyHeading label="RESTORATION" title="Outages & telemetry gaps" detail="Reliability measures duration and affected meters from outage intervals." /><div className="outage-card"><div><span>ACTIVE OUTAGE</span><h2>North feeder protective relay</h2><p>Opened 07:42 · three meters affected · restoration estimate 11:30</p></div><div><strong>{customerMinutesInterrupted(outages, '2027-03-15T10:00:00Z')}</strong><small>customer-minutes interrupted</small></div><button>Open restoration runbook</button></div></>}
      {lens === 'sites' && <><EnergyHeading label="PORTFOLIO" title="Site comparison" detail="Demand peaks and storage reserves are normalized across operating sites." /><div className="site-matrix"><div><strong>Riverside Campus</strong><span>774 kW load</span><span>24% battery</span><b>{estimatedRuntimeHours(24, 500, 120)} h reserve</b></div><div><strong>North Distribution</strong><span>521 kW load</span><span>68% battery</span><b>normal</b></div><div><strong>Harbor Works</strong><span>943 kW load</span><span>41% battery</span><b>peak alert</b></div></div></>}
    </main></div>
}

function EnergyHeading({ label, title, detail, action }: { label: string; title: string; detail: string; action?: ReactNode }) { return <div className="energy-heading"><div><span>{label}</span><h1>{title}</h1><p>{detail}</p></div>{action}</div> }
function Kpi({ label, value }: { label: string; value: string }) { return <article><span>{label}</span><strong>{value}</strong></article> }
export default App
