interface Asset {
    name: string;
    output: number;
    forecast: number;
    status: string;
}
export function EnergyFlow({ assets }: {
    assets: readonly Asset[];
}) {
    const generation = assets.reduce((sum, asset) => sum + asset.output, 0);
    return <section className="energy-flow"><div className="flow-source"><span>ON-SITE ASSETS</span>{assets.map((asset) => <article key={asset.name}><strong>{asset.output} kW</strong><small>{asset.name}</small></article>)}</div><div className="flow-line"><span>→</span><b>{generation} kW</b><span>→</span></div><div className="flow-load"><span>CAMPUS LOAD</span><strong>774 kW</strong><small>{Math.max(0, 774 - generation)} kW grid import</small></div></section>;
}
