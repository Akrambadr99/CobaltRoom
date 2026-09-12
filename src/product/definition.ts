import { committedDischarge, reserveChangeKind, reserveChangeOperations } from '../telemetry/reserve-policy';
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { Product, Kind, Field, Operation, Entity } from '../workspace/types';
import { entity, find, rows, total, text, number, requireThat } from '../workspace/values';
const txt = (key: string, label: string): Field => ({ key, label, type: 'text', required: true });
const num = (key: string, label: string, initial = 0, min = 0, max = Number.MAX_SAFE_INTEGER): Field => ({ key, label, type: 'number', required: true, integer: true, initial, min, max });
const date = (key: string, label: string): Field => ({ key, label, type: 'date', required: true, initial: '2026-09-12' });
const ref = (key: string, label: string, reference: string): Field => ({ key, label, type: 'reference', reference, required: true });
const choice = (key: string, label: string, options: string[]): Field => ({ key, label, type: 'select', options, required: true, initial: options[0] ?? '' });
const kind = (key: string, label: string, states: string[], editors: string[], fields: Field[]): Kind => ({ key, label, states, editors, fields, initial: states[0] ?? 'draft' });
const linked = (entities: Entity[], kind: string, key: string, id: string) => rows(entities, kind).filter(item => item.fields[key] === id);
void txt;
void num;
void date;
void ref;
void choice;
void kind;
void linked;
void entity;
void find;
void rows;
void total;
void text;
void number;
void requireThat;
const roles = ['Grid Controller', 'Energy Operator', 'Reliability Engineer', 'Auditor'];
const kinds = [kind('site', 'Energy sites', ['online', 'islanded', 'offline'], [roles[0]!], [num('capacity', 'Site capacity kW', 5000, 1), { ...num('reserve', 'Required reserve kW', 500), editLocked: true }]), kind('meter', 'Meters', ['healthy', 'stale', 'failed'], [roles[2]!], [ref('site', 'Site', 'site'), txt('channel', 'Telemetry channel'), num('interval', 'Interval minutes', 15, 1, 60)]), kind('reading', 'Telemetry readings', ['accepted', 'corrected'], [roles[1]!], [ref('meter', 'Meter', 'meter'), date('day', 'Reading date'), num('kwh', 'Energy kWh', 100), choice('source', 'Source', ['live', 'historical', 'corrected'])]), kind('battery', 'Battery assets', ['standby', 'charging', 'discharging', 'faulted'], [roles[0]!], [ref('site', 'Site', 'site'), num('capacity', 'Capacity kWh', 1000, 1), num('soc', 'State of charge percent', 50, 0, 100), num('limit', 'Inverter limit kW', 500, 1)]), kind('dispatch', 'Dispatch instructions', ['draft', 'active', 'complete', 'cancelled'], [roles[0]!], [ref('battery', 'Battery', 'battery'), num('power', 'Power kW', 100, 1), choice('mode', 'Mode', ['charge', 'discharge']), num('duration', 'Duration minutes', 60, 1, 1440)]), kind('outage', 'Grid outages', ['open', 'restored'], [roles[2]!], [ref('site', 'Site', 'site'), txt('cause', 'Outage cause'), num('customers', 'Affected customers', 100, 1)]), kind('alarm', 'Telemetry alarms', ['active', 'acknowledged', 'suppressed', 'cleared'], [], [ref('meter', 'Affected meter', 'meter'), choice('severity', 'Severity', ['warning', 'critical']), txt('message', 'Alarm message'), {...txt('acknowledgedBy', 'Acknowledged by'), required: false}, {...date('suppressionUntil', 'Suppression expiry'), required: false}, {...txt('suppressionReason', 'Suppression reason'), required: false}])];
const operations: Operation[] = [{ key: 'activate', label: 'Activate battery dispatch', kind: 'dispatch', from: ['draft'], roles: [roles[0]!], run: ({ state, entity }) => { const battery = find(state.entities, text(entity.fields, 'battery')), site = find(state.entities, text(battery.fields, 'site')); requireThat(site.status === 'online' && battery.status === 'standby', 'Site and battery must be available.'); requireThat(number(entity.fields, 'power') <= number(battery.fields, 'limit'), 'Dispatch exceeds inverter capability.'); requireThat(text(entity.fields, 'mode') !== 'discharge' || committedDischarge(state.entities, site.id) + number(entity.fields, 'power') + number(site.fields, 'reserve') <= number(site.fields, 'capacity'), 'Dispatch would breach committed site reserve.'); const energy = number(entity.fields, 'power') * number(entity.fields, 'duration') / 60, socDelta = energy / number(battery.fields, 'capacity') * 100; const next = number(battery.fields, 'soc') + (text(entity.fields, 'mode') === 'charge' ? socDelta : -socDelta); requireThat(next >= 15 && next <= 95, 'Dispatch would breach battery reserve limits.'); battery.fields['soc'] = Math.round(next); battery.status = text(entity.fields, 'mode') === 'charge' ? 'charging' : 'discharging'; entity.status = 'active'; return 'Dispatch activated after reserve and inverter validation.'; } }, { key: 'complete', label: 'Complete dispatch', kind: 'dispatch', from: ['active'], roles: [roles[1]!], run: ({ state, entity }) => { entity.status = 'complete'; find(state.entities, text(entity.fields, 'battery')).status = 'standby'; return 'Dispatch interval completed; battery returned to standby.'; } }, { key: 'correct', label: 'Correct telemetry reading', kind: 'reading', from: ['accepted'], roles: [roles[2]!], fields: [num('kwh', 'Corrected energy kWh')], run: ({ entity, input }) => { entity.fields['kwh'] = number(input, 'kwh'); entity.fields['source'] = 'corrected'; entity.status = 'corrected'; return 'Reading corrected with an auditable revision.'; } }, { key: 'island', label: 'Declare site outage', kind: 'outage', from: ['open'], roles: [roles[2]!], run: ({ state, entity }) => { const recovery = rows(state.entities, 'recovery').find(item => item.fields['outage'] === entity.id); requireThat(recovery?.status === 'acknowledged', 'Acknowledge recovery before isolation.'); const batteryIds = new Set(linked(state.entities, 'battery', 'site', text(entity.fields, 'site')).map(item => item.id)); requireThat(!rows(state.entities, 'dispatch').some(item => item.status === 'active' && batteryIds.has(text(item.fields, 'battery'))), 'Stop active battery dispatch before isolating the site.'); recovery.status = 'isolated'; find(state.entities, text(entity.fields, 'site')).status = 'islanded'; return 'Site islanded while outage remains open.'; } }, { key: 'restore', label: 'Restore grid service', kind: 'outage', from: ['open'], roles: [roles[2]!], run: ({ state, entity, now }) => {
            const recovery = rows(state.entities, 'recovery').find(item => item.fields['outage'] === entity.id); requireThat(recovery?.status === 'verified', 'Verify recovery telemetry before restoration.'); requireThat(telemetryReady(state.entities, text(entity.fields, 'site'), now) && recovery.fields['token'] === telemetryToken(state.entities, text(entity.fields, 'site')), 'Telemetry changed or expired. Refresh and verify again.'); recovery.status = 'complete'; entity.status = 'restored';
            const site = find(state.entities, text(entity.fields, 'site'));
            if (!linked(state.entities, 'outage', 'site', site.id).some(row => row.status === 'open'))
                site.status = 'online';
            return 'Outage restored and site availability recomputed.';
        } }];
const seed = [entity('site-1', 'site', 'Cairo solar campus', 'online', { capacity: 5000, reserve: 500 }), entity('meter-1', 'meter', 'Main import meter', 'healthy', { site: 'site-1', channel: 'grid.import', interval: 15 }), entity('battery-1', 'battery', 'Battery B1', 'standby', { site: 'site-1', capacity: 1000, soc: 60, limit: 500 }), entity('dispatch-1', 'dispatch', 'Evening peak support', 'draft', { battery: 'battery-1', power: 250, mode: 'discharge', duration: 60 }), entity('alarm-1', 'alarm', 'Import meter drift', 'active', {meter: 'meter-1', severity: 'warning', message: 'Reading drift exceeds the configured tolerance.'})];
const latestSample = (entities: Entity[], meterId: string) => linked(entities, 'reading', 'meter', meterId).filter(item => item.fields['sampledAt']).at(-1);
const telemetryToken = (entities: Entity[], siteId: string) => JSON.stringify(linked(entities, 'meter', 'site', siteId).map(meter => [meter.id, meter.revision, latestSample(entities, meter.id)?.id, latestSample(entities, meter.id)?.revision]));
const telemetryReady = (entities: Entity[], siteId: string, now: string) => {
    const meters = linked(entities, 'meter', 'site', siteId);
    return meters.length > 0 && meters.every(meter => {
        const sample = latestSample(entities, meter.id);
        const age = sample ? Date.parse(now) - Date.parse(String(sample.fields['sampledAt'])) : Infinity;
        return meter.status === 'healthy' && sample?.status === 'accepted' && sample.fields['source'] === 'live' && age >= 0 && age <= 300000;
    });
};
kinds.find(item => item.key === 'reading')!.fields.push({ ...txt('sampledAt', 'Sample timestamp'), required: false });
kinds.push(kind('recovery', 'Outage recovery stages', ['acknowledged', 'isolated', 'failed', 'verified', 'complete'], [], [ref('outage', 'Outage', 'outage'), txt('token', 'Verified telemetry fingerprint'), txt('result', 'Recovery status')]));
operations.push(
    {key: 'stop-dispatch', label: 'Stop battery dispatch', kind: 'dispatch', from: ['active'], roles: [roles[0]!], fields: [txt('reason', 'Dispatch stop reason')], run: ({state, entity, input}) => {
        requireThat(text(input, 'reason').trim().length >= 12, 'Describe why dispatch must stop.');
        entity.status = 'cancelled'; find(state.entities, text(entity.fields, 'battery'), 'battery').status = 'standby';
        return 'Battery dispatch stopped; recorded energy retained. Reason: ' + text(input, 'reason').trim();
    }},
    { key: 'acknowledge-recovery', label: 'Acknowledge recovery', kind: 'outage', from: ['open'], roles: [roles[2]!], run: ({ state, entity, add }) => {
        requireThat(!rows(state.entities, 'recovery').some(item => item.fields['outage'] === entity.id), 'Recovery already acknowledged.');
        add('recovery', 'Recovery · ' + entity.title, { outage: entity.id, token: 'Unverified', result: 'Acknowledged; isolate the site next.' });
        return 'Outage recovery acknowledged; isolation required next.';
    } },
    { key: 'refresh-meter', label: 'Record fresh telemetry', kind: 'meter', from: ['healthy', 'stale', 'failed'], roles: [roles[1]!], fields: [choice('health', 'Sample health', ['healthy', 'failed']), num('kwh', 'Measured energy kWh', 100)], run: ({ entity, input, now, add }) => {
        entity.status = text(input, 'health');
        add('reading', 'Recovery telemetry · ' + entity.title, { meter: entity.id, day: now.slice(0, 10), kwh: number(input, 'kwh'), source: 'live', sampledAt: now });
        return entity.status === 'healthy' ? 'Fresh telemetry recorded.' : 'Telemetry failure recorded; restoration remains blocked.';
    } },
    { key: 'verify-recovery', label: 'Verify recovery telemetry', kind: 'recovery', from: ['isolated', 'failed', 'verified'], roles: [roles[2]!], run: ({ state, entity, now }) => {
        const outage = find(state.entities, text(entity.fields, 'outage'), 'outage');
        const siteId = text(outage.fields, 'site');
        requireThat(outage.status === 'open' && find(state.entities, siteId, 'site').status === 'islanded', 'Recovery requires an isolated site and an open outage.');
        const ready = telemetryReady(state.entities, siteId, now);
        entity.status = ready ? 'verified' : 'failed';
        entity.fields['token'] = ready ? telemetryToken(state.entities, siteId) : 'Unverified';
        entity.fields['result'] = ready ? 'Fresh healthy telemetry verified; ready to restore.' : 'Verification failed. Record fresh healthy telemetry for every site meter, then retry.';
        return text(entity.fields, 'result');
    } },
);
operations.push(
    {key: 'acknowledge-alarm', label: 'Acknowledge telemetry alarm', kind: 'alarm', from: ['active'], roles: [roles[2]!], run: ({entity, actor}) => {
        entity.status = 'acknowledged'; entity.fields['acknowledgedBy'] = actor.name;
        return 'Alarm acknowledged; fresh telemetry is required before clearance.';
    }},
    {key: 'suppress-alarm', label: 'Suppress acknowledged alarm', kind: 'alarm', from: ['acknowledged'], roles: [roles[0]!], fields: [date('until', 'Suppression expiry'), txt('reason', 'Suppression reason')], run: ({entity, input, now}) => {
        const until = Date.parse(text(input, 'until')), started = Date.parse(now);
        requireThat(until > started && until - started <= 7 * 86400000, 'Suppression expiry must be within the next seven days.');
        requireThat(text(input, 'reason').trim().length >= 12, 'Provide a specific suppression reason.');
        entity.status = 'suppressed'; entity.fields['suppressionUntil'] = text(input, 'until'); entity.fields['suppressionReason'] = text(input, 'reason').trim();
        return 'Alarm suppressed temporarily; acknowledgement history preserved.';
    }},
    {key: 'expire-suppression', label: 'Restore expired alarm', kind: 'alarm', from: ['suppressed'], roles: [roles[2]!], run: ({entity, now}) => {
        requireThat(Date.parse(now) >= Date.parse(text(entity.fields, 'suppressionUntil')), 'Suppression period has not expired.');
        entity.status = 'acknowledged';
        return 'Suppression expired; acknowledged alarm restored for review.';
    }},
    {key: 'clear-alarm', label: 'Clear telemetry alarm', kind: 'alarm', from: ['acknowledged'], roles: [roles[2]!], run: ({state, entity, now}) => {
        const meter = find(state.entities, text(entity.fields, 'meter'), 'meter');
        const sample = latestSample(state.entities, meter.id);
        const age = sample ? Date.parse(now) - Date.parse(text(sample.fields, 'sampledAt')) : Infinity;
        requireThat(meter.status === 'healthy' && sample?.status === 'accepted' && age >= 0 && age <= 300000, 'Record fresh healthy telemetry before clearing the alarm.');
        entity.status = 'cleared';
        return 'Alarm cleared against fresh healthy telemetry.';
    }},
);
kinds.push(reserveChangeKind);
operations.push(...reserveChangeOperations);
const validate: Product['validate'] = entities => {
    for (const battery of rows(entities, 'battery'))
        requireThat(number(battery.fields, 'soc') >= 0 && number(battery.fields, 'soc') <= 100, 'Battery state of charge is invalid.');
    for (const alarm of rows(entities, 'alarm')) if (alarm.status === 'suppressed') requireThat(Boolean(alarm.fields['acknowledgedBy']) && Boolean(alarm.fields['suppressionUntil']), 'Suppressed alarms require acknowledgement and expiry evidence.');
};
const metrics: Product['metrics'] = entities => [{ label: 'Online sites', value: String(rows(entities, 'site').filter(row => row.status === 'online').length) }, { label: 'Open outages', value: String(rows(entities, 'outage').filter(row => row.status === 'open').length) }, { label: 'Accepted energy', value: String(total(rows(entities, 'reading'), 'kwh')) + ' kWh' }];
export const product: Product = { name: 'GridLoom', description: 'Validated telemetry, battery dispatch and outage recovery', accent: '#047857', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
