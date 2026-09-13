import { describe, expect, it } from 'vitest';
import {
  approveRestoration,
  engineerSequence,
  executeNextSwitch,
  initialRestorationState,
  openRestorationDossier,
  refreshRestorationTelemetry,
  verifyRestoration,
} from './restoration-dossier';

const meta = (id: string, revision: number, actor: string, role: 'Grid Controller' | 'Reliability Engineer' | 'Field Operator' | 'Shift Supervisor') => ({ id, expectedRevision: revision, actor: { id: actor, role } });

describe('restoration authorization dossier', () => {
  it('executes ordered switching with telemetry refresh between stages', () => {
    let state = openRestorationDossier(initialRestorationState, meta('open', 0, 'controller', 'Grid Controller'));
    state = engineerSequence(state, { ...meta('engineer', 1, 'reliability', 'Reliability Engineer'), switchIds: ['SW-14', 'SW-18'], rationale: 'Sequence restores the bus while preserving protection coordination.' });
    state = refreshRestorationTelemetry(state, { ...meta('fresh-1', 2, 'reliability', 'Reliability Engineer'), capturedAt: '2026-09-13T14:05:00Z', voltageKv: 11.1, frequencyHz: 50 });
    state = approveRestoration(state, meta('approve', 3, 'supervisor', 'Shift Supervisor'));
    state = executeNextSwitch(state, meta('stage-1', 4, 'field', 'Field Operator'));
    state = refreshRestorationTelemetry(state, { ...meta('fresh-2', 5, 'reliability', 'Reliability Engineer'), capturedAt: '2026-09-13T14:10:00Z', voltageKv: 11, frequencyHz: 50.05 });
    state = executeNextSwitch(state, meta('stage-2', 6, 'field', 'Field Operator'));
    state = refreshRestorationTelemetry(state, { ...meta('fresh-3', 7, 'reliability', 'Reliability Engineer'), capturedAt: '2026-09-13T14:15:00Z', voltageKv: 10.9, frequencyHz: 50.02 });
    state = verifyRestoration(state, meta('verify', 8, 'controller', 'Grid Controller'));
    expect(state.outage.status).toBe('restored');
    expect(state.alarm.status).toBe('cleared');
    expect(state.switches.every((item) => item.status === 'closed')).toBe(true);
    expect(state.events).toHaveLength(9);
  });

  it('rejects an out-of-order switching plan', () => {
    const state = openRestorationDossier(initialRestorationState, meta('open', 0, 'controller', 'Grid Controller'));
    expect(() => engineerSequence(state, { ...meta('engineer', 1, 'reliability', 'Reliability Engineer'), switchIds: ['SW-18', 'SW-14'], rationale: 'Sequence was prepared from an obsolete switching instruction.' })).toThrow('engineered order');
  });

  it('requires refreshed telemetry after every switching stage', () => {
    let state = openRestorationDossier(initialRestorationState, meta('open', 0, 'controller', 'Grid Controller'));
    state = engineerSequence(state, { ...meta('engineer', 1, 'reliability', 'Reliability Engineer'), switchIds: ['SW-14', 'SW-18'], rationale: 'Sequence restores the bus while preserving protection coordination.' });
    state = refreshRestorationTelemetry(state, { ...meta('fresh', 2, 'reliability', 'Reliability Engineer'), capturedAt: '2026-09-13T14:05:00Z', voltageKv: 11.1, frequencyHz: 50 });
    state = approveRestoration(state, meta('approve', 3, 'supervisor', 'Shift Supervisor'));
    state = executeNextSwitch(state, meta('stage-1', 4, 'field', 'Field Operator'));
    expect(() => executeNextSwitch(state, meta('stage-2', 5, 'field', 'Field Operator'))).toThrow('Telemetry changed');
  });
});
