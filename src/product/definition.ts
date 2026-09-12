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
const kinds = [kind('site', 'Energy sites', ['online', 'islanded', 'offline'], [roles[0]!], [num('capacity', 'Site capacity kW', 5000, 1), num('reserve', 'Required reserve kW', 500)]), kind('meter', 'Meters', ['healthy', 'stale', 'failed'], [roles[2]!], [ref('site', 'Site', 'site'), txt('channel', 'Telemetry channel'), num('interval', 'Interval minutes', 15, 1, 60)]), kind('reading', 'Telemetry readings', ['accepted', 'corrected'], [roles[1]!], [ref('meter', 'Meter', 'meter'), date('day', 'Reading date'), num('kwh', 'Energy kWh', 100), choice('source', 'Source', ['live', 'historical', 'corrected'])]), kind('battery', 'Battery assets', ['standby', 'charging', 'discharging', 'faulted'], [roles[0]!], [ref('site', 'Site', 'site'), num('capacity', 'Capacity kWh', 1000, 1), num('soc', 'State of charge percent', 50, 0, 100), num('limit', 'Inverter limit kW', 500, 1)]), kind('dispatch', 'Dispatch instructions', ['draft', 'active', 'complete', 'cancelled'], [roles[0]!], [ref('battery', 'Battery', 'battery'), num('power', 'Power kW', 100, 1), choice('mode', 'Mode', ['charge', 'discharge']), num('duration', 'Duration minutes', 60, 1, 1440)]), kind('outage', 'Grid outages', ['open', 'restored'], [roles[2]!], [ref('site', 'Site', 'site'), txt('cause', 'Outage cause'), num('customers', 'Affected customers', 100, 1)])];
const operations: Operation[] = [{ key: 'activate', label: 'Activate battery dispatch', kind: 'dispatch', from: ['draft'], roles: [roles[0]!], run: ({ state, entity }) => { const battery = find(state.entities, text(entity.fields, 'battery')), site = find(state.entities, text(battery.fields, 'site')); requireThat(site.status === 'online' && battery.status === 'standby', 'Site and battery must be available.'); requireThat(number(entity.fields, 'power') <= number(battery.fields, 'limit'), 'Dispatch exceeds inverter capability.'); const energy = number(entity.fields, 'power') * number(entity.fields, 'duration') / 60, socDelta = energy / number(battery.fields, 'capacity') * 100; const next = number(battery.fields, 'soc') + (text(entity.fields, 'mode') === 'charge' ? socDelta : -socDelta); requireThat(next >= 15 && next <= 95, 'Dispatch would breach battery reserve limits.'); battery.fields['soc'] = Math.round(next); battery.status = text(entity.fields, 'mode') === 'charge' ? 'charging' : 'discharging'; entity.status = 'active'; return 'Dispatch activated after reserve and inverter validation.'; } }, { key: 'complete', label: 'Complete dispatch', kind: 'dispatch', from: ['active'], roles: [roles[1]!], run: ({ state, entity }) => { entity.status = 'complete'; find(state.entities, text(entity.fields, 'battery')).status = 'standby'; return 'Dispatch interval completed; battery returned to standby.'; } }, { key: 'correct', label: 'Correct telemetry reading', kind: 'reading', from: ['accepted'], roles: [roles[2]!], fields: [num('kwh', 'Corrected energy kWh')], run: ({ entity, input }) => { entity.fields['kwh'] = number(input, 'kwh'); entity.fields['source'] = 'corrected'; entity.status = 'corrected'; return 'Reading corrected with an auditable revision.'; } }, { key: 'island', label: 'Declare site outage', kind: 'outage', from: ['open'], roles: [roles[2]!], run: ({ state, entity }) => { find(state.entities, text(entity.fields, 'site')).status = 'islanded'; return 'Site islanded while outage remains open.'; } }, { key: 'restore', label: 'Restore grid service', kind: 'outage', from: ['open'], roles: [roles[2]!], run: ({ state, entity }) => {
            entity.status = 'restored';
            const site = find(state.entities, text(entity.fields, 'site'));
            if (!linked(state.entities, 'outage', 'site', site.id).some(row => row.status === 'open'))
                site.status = 'online';
            return 'Outage restored and site availability recomputed.';
        } }];
const seed = [entity('site-1', 'site', 'Cairo solar campus', 'online', { capacity: 5000, reserve: 500 }), entity('meter-1', 'meter', 'Main import meter', 'healthy', { site: 'site-1', channel: 'grid.import', interval: 15 }), entity('battery-1', 'battery', 'Battery B1', 'standby', { site: 'site-1', capacity: 1000, soc: 60, limit: 500 }), entity('dispatch-1', 'dispatch', 'Evening peak support', 'draft', { battery: 'battery-1', power: 250, mode: 'discharge', duration: 60 })];
const validate: Product['validate'] = entities => {
    for (const battery of rows(entities, 'battery'))
        requireThat(number(battery.fields, 'soc') >= 0 && number(battery.fields, 'soc') <= 100, 'Battery state of charge is invalid.');
};
const metrics: Product['metrics'] = entities => [{ label: 'Online sites', value: String(rows(entities, 'site').filter(row => row.status === 'online').length) }, { label: 'Open outages', value: String(rows(entities, 'outage').filter(row => row.status === 'open').length) }, { label: 'Accepted energy', value: String(total(rows(entities, 'reading'), 'kwh')) + ' kWh' }];
export const product: Product = { name: 'GridLoom', description: 'Validated telemetry, battery dispatch and outage recovery', accent: '#047857', actors: roles.map((role, index) => ({ id: 'actor-' + String(index), name: ['Maya Hassan', 'Omar Saleh', 'Lina Farouk', 'Nadia Ali'][index] ?? role, role })), kinds, operations, seed, validate, metrics };
