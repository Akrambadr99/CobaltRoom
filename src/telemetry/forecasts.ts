export interface ForecastPoint {
    at: string;
    expectedKwh: number;
    lowerKwh: number;
    upperKwh: number;
}
export interface ActualPoint {
    at: string;
    actualKwh: number;
}
export function forecastVariance(forecast: ForecastPoint[], actual: ActualPoint[]) {
    const actualByTime = new Map(actual.map((point) => [point.at, point.actualKwh]));
    return forecast.flatMap((point) => {
        const measured = actualByTime.get(point.at);
        if (measured === undefined)
            return [];
        return [{ at: point.at, expectedKwh: point.expectedKwh, actualKwh: measured, varianceKwh: measured - point.expectedKwh, outsideBand: measured < point.lowerKwh || measured > point.upperKwh }];
    });
}
export function meanAbsolutePercentageError(forecast: ForecastPoint[], actual: ActualPoint[]): number {
    const variance = forecastVariance(forecast, actual).filter((point) => point.actualKwh !== 0);
    if (variance.length === 0)
        return 0;
    return Math.round(variance.reduce((sum, point) => sum + Math.abs(point.varianceKwh / point.actualKwh), 0) / variance.length * 10000) / 100;
}
