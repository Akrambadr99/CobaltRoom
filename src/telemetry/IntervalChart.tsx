import type { Reading } from './series';
export function IntervalChart({ readings }: {
    readings: Reading[];
}) {
    const max = Math.max(...readings.map((reading) => reading.kwh), 1);
    const points = readings.map((reading, index) => `${String(index / Math.max(1, readings.length - 1) * 100)},${String(88 - reading.kwh / max * 70)}`).join(' ');
    return <figure className="interval-chart"><figcaption><div><span>CONSUMPTION TRACE</span><strong>15 minute intervals</strong></div><div className="legend"><i className="live"/>live <i className="corrected"/>corrected</div></figcaption><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Electricity consumption interval chart"><g className="grid-lines"><line x1="0" y1="20" x2="100" y2="20"/><line x1="0" y1="50" x2="100" y2="50"/><line x1="0" y1="80" x2="100" y2="80"/></g><polyline points={points}/>{readings.map((reading, index) => <circle key={`${reading.at}-${reading.source}`} cx={index / Math.max(1, readings.length - 1) * 100} cy={88 - reading.kwh / max * 70} r="1.8" className={reading.source}><title>{reading.at.slice(11, 16)} · {reading.kwh} kWh · {reading.source}</title></circle>)}</svg><div className="x-axis">{readings.filter((_, index) => index % 2 === 0).map((reading) => <span key={reading.at}>{reading.at.slice(11, 16)}</span>)}</div></figure>;
}
