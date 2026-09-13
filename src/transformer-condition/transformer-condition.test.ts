import { describe, expect, it } from 'vitest';
import { analyzeTransformerSample, approveTransformerMaintenance, collectTransformerSample, initialTransformerConditionState, isolateConditionTransformer, restoreConditionTransformer, serviceTransformerOil, verifyTransformerRecovery, type TransformerRole } from './transformer-condition';

const meta = (id: string, revision: number, actor: string, role: TransformerRole) => ({ id, expectedRevision: revision, actor: { id: actor, role } });

function serviced() {
  let state = collectTransformerSample(initialTransformerConditionState, { ...meta('sample', 0, 'field', 'Field Technician'), sampleSeal: 'SEAL-A1B2C3D4' });
  state = analyzeTransformerSample(state, { ...meta('analyze', 1, 'lab', 'Laboratory Analyst'), sampleSeal: 'SEAL-A1B2C3D4', dissolvedGasPpm: 920 });
  state = approveTransformerMaintenance(state, meta('approve', 2, 'engineer', 'Asset Engineer'));
  state = isolateConditionTransformer(state, meta('isolate', 3, 'operator', 'Control Operator'));
  return serviceTransformerOil(state, { ...meta('service', 4, 'crew', 'Maintenance Crew'), replacementBatch: 'OIL-NEW-42' });
}

describe('transformer condition management', () => {
  it('restores load after fresh independent oil-condition verification', () => {
    let state = verifyTransformerRecovery(serviced(), { ...meta('verify', 5, 'auditor', 'Reliability Auditor'), dissolvedGasPpm: 140, sampledAt: '2026-09-14T09:00:00Z' });
    state = restoreConditionTransformer(state, meta('restore', 6, 'operator', 'Control Operator'));
    expect(state.case?.status).toBe('closed');
    expect(state.transformer).toMatchObject({ status: 'service', oilBatch: 'OIL-NEW-42', dissolvedGasPpm: 140 });
    expect(state.feeder.status).toBe('normal');
    expect(state.evidence).toHaveLength(3);
  });

  it('rejects recovery evidence above the release limit', () => {
    expect(() => verifyTransformerRecovery(serviced(), { ...meta('verify', 5, 'auditor', 'Reliability Auditor'), dissolvedGasPpm: 280, sampledAt: '2026-09-14T09:00:00Z' })).toThrow('release limits');
  });

  it('protects analysis from changed transformer provenance', () => {
    const state = collectTransformerSample(initialTransformerConditionState, { ...meta('sample', 0, 'field', 'Field Technician'), sampleSeal: 'SEAL-A1B2C3D4' });
    state.transformer.version += 1;
    expect(() => analyzeTransformerSample(state, { ...meta('analyze', 1, 'lab', 'Laboratory Analyst'), sampleSeal: 'SEAL-A1B2C3D4', dissolvedGasPpm: 920 })).toThrow('Transformer changed');
  });
});
