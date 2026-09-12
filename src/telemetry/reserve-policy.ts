import type { Context, Entity, Field, Kind, Operation } from '../workspace/types';
import { find, number, requireThat, rows, text } from '../workspace/values';
const reserve: Field = { key: 'reserve', label: 'Proposed reserve kW', type: 'number', min: 0, integer: true, required: true };
const reason: Field = { key: 'reason', label: 'Reserve justification', type: 'text', required: true };
export const reserveChangeKind: Kind = {
    key: 'reserve-change', label: 'Reserve changes', initial: 'requested', editors: [],
    states: ['requested', 'approved', 'rejected', 'applied', 'cancelled'],
    fields: [reserve, reason,
        { key: 'site', label: 'Affected site', type: 'reference', reference: 'site', required: true },
        { key: 'siteVersion', label: 'Site version', type: 'number', min: 1, integer: true, required: true },
        { key: 'requester', label: 'Requesting actor', type: 'text', required: true },
    ],
};
export function committedDischarge(entities: Entity[], siteId: string) {
    const batteries = new Set(rows(entities, 'battery').filter(item => item.fields['site'] === siteId).map(item => item.id));
    return rows(entities, 'dispatch').filter(item => item.status === 'active' && item.fields['mode'] === 'discharge' && batteries.has(text(item.fields, 'battery')))
        .reduce((sum, item) => sum + number(item.fields, 'power'), 0);
}
function checkReserve(entities: Entity[], site: Entity, value: number) {
    requireThat(site.status === 'online', 'Site must be online to change reserve policy.');
    requireThat(value + committedDischarge(entities, site.id) <= number(site.fields, 'capacity'), 'Reserve would conflict with committed battery dispatch.');
}
function justification(context: Context) {
    const value = text(context.input, 'reason').trim();
    requireThat(value.length >= 20, 'Explain the reserve change in at least 20 characters.');
    return value;
}
function currentSite(context: Context) {
    const site = find(context.state.entities, text(context.entity.fields, 'site'), 'site');
    requireThat(site.revision === context.entity.fields['siteVersion'], 'Site changed. Revise the reserve request before approval or application.');
    checkReserve(context.state.entities, site, number(context.entity.fields, 'reserve'));
    return site;
}
export const reserveChangeOperations: Operation[] = [
    {
        key: 'reserve-request', label: 'Request reserve change', kind: 'site', from: ['online'], roles: ['Energy Operator'], fields: [reserve, reason],
        run: context => {
            requireThat(!rows(context.state.entities, 'reserve-change').some(item => item.fields['site'] === context.entity.id && ['requested', 'approved'].includes(item.status)), 'A reserve change is already pending for this site.');
            checkReserve(context.state.entities, context.entity, number(context.input, 'reserve'));
            context.add('reserve-change', 'Reserve change - ' + context.entity.title, {
                site: context.entity.id, siteVersion: context.entity.revision, reserve: number(context.input, 'reserve'),
                requester: context.actor.id, reason: justification(context),
            });
            return 'Reserve change requested with a pinned site revision.';
        },
    },
    {
        key: 'reserve-revise', label: 'Revise reserve request', kind: 'reserve-change', from: ['requested', 'rejected', 'approved'], roles: ['Energy Operator'], fields: [reserve, reason],
        run: context => {
            requireThat(context.entity.fields['requester'] === context.actor.id, 'Only the requester may revise this reserve change.');
            const site = find(context.state.entities, text(context.entity.fields, 'site'), 'site');
            requireThat(!rows(context.state.entities, 'reserve-change').some(item => item.id !== context.entity.id && item.fields['site'] === site.id && ['requested', 'approved'].includes(item.status)), 'Another reserve change is pending.');
            checkReserve(context.state.entities, site, number(context.input, 'reserve'));
            context.entity.fields = { ...context.entity.fields, siteVersion: site.revision, reserve: number(context.input, 'reserve'), reason: justification(context) };
            context.entity.status = 'requested';
            return 'Reserve request revised; prior approval is invalidated.';
        },
    },
    {
        key: 'reserve-approve', label: 'Approve reserve request', kind: 'reserve-change', from: ['requested'], roles: ['Grid Controller'],
        run: context => {
            currentSite(context);
            requireThat(context.entity.fields['requester'] !== context.actor.id, 'Reserve approval requires an independent controller.');
            context.entity.status = 'approved';
            return 'Reserve change approved; application will recheck current dispatch commitments.';
        },
    },
    {
        key: 'reserve-reject', label: 'Reject reserve request', kind: 'reserve-change', from: ['requested', 'approved'], roles: ['Grid Controller'], fields: [reason],
        run: context => {
            const note = justification(context);
            context.entity.status = 'rejected';
            return 'Reserve request rejected: ' + note;
        },
    },
    {
        key: 'reserve-apply', label: 'Apply approved reserve', kind: 'reserve-change', from: ['approved'], roles: ['Grid Controller'],
        run: context => {
            const site = currentSite(context);
            site.fields['reserve'] = number(context.entity.fields, 'reserve');
            context.entity.status = 'applied';
            return 'Approved reserve policy applied to the site and future dispatch.';
        },
    },
    {
        key: 'reserve-cancel', label: 'Cancel reserve request', kind: 'reserve-change', from: ['requested', 'approved', 'rejected'], roles: ['Energy Operator'], fields: [reason],
        run: context => {
            requireThat(context.entity.fields['requester'] === context.actor.id, 'Only the requester may cancel this reserve change.');
            const note = justification(context);context.entity.status = 'cancelled';
            return 'Reserve change cancelled without changing the site: ' + note;
        },
    },
];
