export interface MeterOperationalCase{caseId:string;accountId:string;meterSerial:string;fieldOwner:string;customerOwner:string;openedOn:string;disposalEvidence:'valid'|'damaged'|'missing';paymentCommitment:'current'|'missed'|'none';contactAttempts:number;balanceCents:number}
export const meterCasePolicy={highBalanceCents:20000,agedDays:5} as const;export const seededMeterCases:MeterOperationalCase[]=[{caseId:'MX-881',accountId:'ACCOUNT-881',meterSerial:'NEW-881-B',fieldOwner:'supervisor',customerOwner:'customer-care',openedOn:'2026-10-16',disposalEvidence:'damaged',paymentCommitment:'current',contactAttempts:1,balanceCents:14010},{caseId:'MX-905',accountId:'ACCOUNT-905',meterSerial:'NEW-905-C',fieldOwner:'field-west',customerOwner:'care-west',openedOn:'2026-10-11',disposalEvidence:'missing',paymentCommitment:'missed',contactAttempts:3,balanceCents:28400},{caseId:'MX-930',accountId:'ACCOUNT-930',meterSerial:'NEW-930-A',fieldOwner:'field-east',customerOwner:'care-east',openedOn:'2026-10-18',disposalEvidence:'valid',paymentCommitment:'current',contactAttempts:1,balanceCents:8200}];
export function meterCaseWorkload(records: MeterOperationalCase[], asOf: string) {
  const priorityRank = { urgent: 0, 'follow-up': 1, ready: 2 } as const
  return records.map((record) => {
    const ageDays = Math.floor((Date.parse(asOf) - Date.parse(record.openedOn)) / 86_400_000)
    const blockers = [record.disposalEvidence !== 'valid' ? 'field custody' : null, record.paymentCommitment === 'missed' ? 'customer commitment' : null].filter((value): value is string => value !== null)
    const priority: keyof typeof priorityRank = blockers.length === 2 || (ageDays >= meterCasePolicy.agedDays && record.balanceCents >= meterCasePolicy.highBalanceCents) ? 'urgent' : blockers.length > 0 ? 'follow-up' : 'ready'
    return { ...record, ageDays, blockers, priority, nextAction: blockers[0] ?? 'close case' }
  }).sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || b.balanceCents - a.balanceCents)
}
