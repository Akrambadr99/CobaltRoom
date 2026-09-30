import { useRef, useState } from "react";
import { meterCaseWorkload } from "./meter-case-workload";
import {
  BrowserMeterWorkloadPersistence,
  MeterWorkloadRepository,
  contractorEligibility,
  contractorCertificationImpact,
  custodyRemediationProgress,
  custodyAuthorizationReadiness,
  plannedCustodyReadiness,
  captureMeterCaseSnapshot,
  parseMeterCaseSnapshot,
  previewMeterCaseRestore,
  type MeterDisposalStage,
  type MeterCaseRecoverySnapshot,
  type MeterWorkloadRole,
} from "./meter-control-domain";

export function MeterWorkloadControl() {
  const [repository] = useState(
    () =>
      new MeterWorkloadRepository(
        new BrowserMeterWorkloadPersistence(localStorage),
      ),
  );
  const [state, setState] = useState(() => repository.read());
  const [role, setRole] = useState<MeterWorkloadRole>("Operations Viewer");
  const [message, setMessage] = useState("");
  const [recoverySnapshot, setRecoverySnapshot] = useState<MeterCaseRecoverySnapshot | null>(() => {
    try { const saved = localStorage.getItem('gridloom:meter-case-recovery:v1'); return saved ? parseMeterCaseSnapshot(saved) : null; } catch { return null; }
  });
  const [contractorId, setContractorId] = useState(() => { const caseId = localStorage.getItem('gridloom:meter-selected-case:v1') ?? 'MX-905'; return plannedCustodyReadiness(state, caseId)?.plan.contractorId ?? state.disposalEvents.filter((item) => item.caseId === caseId).at(-1)?.contractorId ?? 'CONTRACTOR-CMS'; });
  const [impactContractorId, setImpactContractorId] = useState('CONTRACTOR-CMS');
  const [custodyCaseId, setCustodyCaseId] = useState(() => { const saved = localStorage.getItem('gridloom:meter-selected-case:v1'); return typeof saved === 'string' && state.cases.some((item) => item.caseId === saved) ? saved : 'MX-905'; });
  const selectedCase = state.cases.find((item) => item.caseId === custodyCaseId);
  const caseFollowUps = state.followUps.filter((item) => item.caseId === custodyCaseId);
  const caseDisposalEvents = state.disposalEvents.filter((item) => item.caseId === custodyCaseId);
  const caseClosures = state.closures.filter((item) => item.caseId === custodyCaseId);
  const [caseDrafts, setCaseDrafts] = useState<Record<string, { contact: string; reason: string; custody: string; evidence: string; acknowledgement: string; certificate: string; billing: string; payment: string; reviewReason?: string; reviewEvidence?: string }>>({ 'MX-905': { contact: 'Customer confirmed the missed commitment by telephone.', reason: 'Payment and custody blockers require one accountable recovery owner.', custody: 'CUSTODY-905', evidence: 'DISPOSAL', acknowledgement: 'ACK-905', certificate: state.disposalEvents.filter((item) => item.caseId === 'MX-905' && item.certificateReference).at(-1)?.certificateReference ?? 'DISPOSAL-905', billing: 'BILL-ADJ-905', payment: 'PLAN-905' } });
  const caseDraft = caseDrafts[custodyCaseId] ?? { contact: '', reason: '', custody: '', evidence: '', acknowledgement: '', certificate: caseDisposalEvents.filter((item) => item.certificateReference).at(-1)?.certificateReference ?? '', billing: '', payment: '' };
  const updateCaseDraft = (draft: typeof caseDraft) => { setCaseDrafts((current) => ({ ...current, [custodyCaseId]: draft })); };
  const [deferralReason, setDeferralReason] = useState('Replacement contractor evidence requires a separate case review.');
  const [deferralReviewOn, setDeferralReviewOn] = useState('2026-10-25');
  const [reviewEvidence, setReviewEvidence] = useState('Updated contractor eligibility register and planned custody reviewed.');
  const [nextReviewOn, setNextReviewOn] = useState('2026-11-02');
  const [certificationExpiresOn, setCertificationExpiresOn] = useState("2027-11-30");
  const [handoffOn, setHandoffOn] = useState(() => plannedCustodyReadiness(state, custodyCaseId)?.plan.scheduledOn ?? "2026-12-01");
  const [amendmentReason, setAmendmentReason] = useState('Replacement contractor acceptance reviewed before physical custody transfer.');
  const [amendmentEvidence, setAmendmentEvidence] = useState('CUSTODY-AUTHORIZATION-905');
  const feedback = useRef<HTMLParagraphElement>(null);
  const workload = meterCaseWorkload(state.cases, "2026-10-20");
  const selectedContractor = state.contractors.find((item) => item.id === contractorId);
  const certificationImpact = contractorCertificationImpact(state, impactContractorId, '2026-10-20');
  const remediation = custodyRemediationProgress(state, impactContractorId, '2026-10-20');
  const selectedImpact = remediation.cases.find((item) => item.caseId === custodyCaseId);
  const selectedDeferral = state.remediationDeferrals.filter((item) => item.caseId === custodyCaseId).at(-1);
  const pendingDeferral = selectedDeferral && !state.deferralReviews.some((item) => item.deferralId === selectedDeferral.id) ? selectedDeferral : null;
  const custodyReadiness = plannedCustodyReadiness(state, custodyCaseId);
  const recoveryPreview = recoverySnapshot ? previewMeterCaseRestore(state, recoverySnapshot, custodyCaseId) : null;
  const captureRecovery = () => { try { const snapshot = captureMeterCaseSnapshot(state, { id: crypto.randomUUID(), caseId: custodyCaseId, role, createdOn: '2026-10-20' }); localStorage.setItem('gridloom:meter-case-recovery:v1', JSON.stringify(snapshot)); setRecoverySnapshot(snapshot); setMessage('Case recovery snapshot captured with pinned revision and custody references.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery capture failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const restoreRecovery = () => { if (!recoverySnapshot) return; try { setState(repository.restore(recoverySnapshot, { id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId, restoredBy: 'Operations supervisor', restoredOn: '2026-10-20' })); setMessage('Verified meter case snapshot restored; restoration recorded in immutable activity.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery restore failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const importRecovery = async (file: File | undefined) => { if (!file) return; try { const snapshot = parseMeterCaseSnapshot(await file.text()); setRecoverySnapshot(snapshot); setMessage('Meter recovery archive loaded for preview; current case has not changed.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Recovery archive import failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const custodyAuthorization = custodyAuthorizationReadiness(state, custodyCaseId);
  const amendCustody = () => { if (!custodyAuthorization.authorization || !custodyAuthorization.plan) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId, planId: custodyAuthorization.plan.id, authorizationEventId: custodyAuthorization.authorization.id, reason: amendmentReason, approvalEvidence: amendmentEvidence, approvedBy: 'Assurance supervisor', approvedOn: '2026-10-23' })); setMessage('Replacement custody authorization approved; original contractor authorization remains historical.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Custody authorization amendment failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const planCustody = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId, contractorId, scheduledOn: handoffOn, plannedBy: "Operations supervisor", plannedOn: "2026-10-20" })); setMessage("Planned custody recorded; contractor eligibility assessed for the handoff date."); } catch (error) { setMessage(error instanceof Error ? error.message : "Custody planning failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const reassignCustody = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId, contractorId, scheduledOn: handoffOn, reassignedBy: "Operations supervisor", reassignedOn: "2026-10-20", reason: "Original contractor certification does not cover the planned handoff date." })); setMessage("Planned custody reassigned to an eligible contractor; original plan preserved."); } catch (error) { setMessage(error instanceof Error ? error.message : "Custody reassignment failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const deferRemediation = () => { if (!selectedImpact?.certificationEventId) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId, affectedHandoffId: selectedImpact.originalPlanId, certificationEventId: selectedImpact.certificationEventId, owner: 'Operations supervisor', reason: deferralReason, reviewOn: deferralReviewOn, deferredOn: '2026-10-20' })); setMessage(`${custodyCaseId} deferred for case-specific contractor review; other plans were unchanged.`); } catch (error) { setMessage(error instanceof Error ? error.message : 'Custody remediation deferral failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const reviewDeferral = (decision: 'continue' | 'reassign') => { if (!pendingDeferral) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, deferralId: pendingDeferral.id, decision, reviewedBy: 'Assurance supervisor', reviewedOn: '2026-10-28', evidenceReference: reviewEvidence, nextReviewOn, replacementContractorId: contractorId, scheduledOn: handoffOn })); setMessage(decision === 'continue' ? 'Deferred custody reviewed with a new accountable review date.' : 'Deferred custody reviewed and reassigned to an eligible contractor.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Deferred custody review failed.'); } queueMicrotask(() => feedback.current?.focus()); };
  const acknowledgeNotice = () => { if (!custodyReadiness?.notice) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, noticeId: custodyReadiness.notice.id, actor: "Operations supervisor", acknowledgedOn: "2026-10-20" })); setMessage("Contractor eligibility notice acknowledged; ineligible custody remains blocked."); } catch (error) { setMessage(error instanceof Error ? error.message : "Notice acknowledgement failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const updateCertification = (active: boolean) => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, contractorId, active, certificationExpiresOn, actor: "Operations supervisor", reason: active ? "Current disposal certification independently verified." : "Contractor authorization suspended pending evidence review.", changedOn: "2026-10-20" })); setMessage(active ? "Contractor certification renewed." : "Contractor authorization suspended."); } catch (error) { setMessage(error instanceof Error ? error.message : "Contractor authorization failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const coordinate = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          caseId: custodyCaseId,
          owner: workload.find((item) => item.caseId === custodyCaseId)?.priority === "urgent" ? "Revenue recovery" : "Operations custody",
          scheduledOn: "2026-10-21",
          asOf: "2026-10-20",
          contactEvidence: caseDraft.contact,
          escalationReason: caseDraft.reason,
          ...(workload.find((item) => item.caseId === custodyCaseId)?.priority === 'urgent' ? {} : { scope: 'field custody' as const }),
        }),
      );
      setMessage(workload.find((item) => item.caseId === custodyCaseId)?.priority === "urgent" ? "Customer and field follow-up coordinated under one owner." : "Field custody follow-up coordinated; customer ownership preserved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Meter follow-up failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const lastDisposal = caseDisposalEvents.at(-1);
  const reviewable = lastDisposal?.stage === 'received' || lastDisposal?.stage === 'evidence-corrected';
  const nextDisposalStage: MeterDisposalStage | null = !lastDisposal ? 'requested' : lastDisposal.stage === 'requested' ? 'authorized' : lastDisposal.stage === 'authorized' ? 'handed-off' : lastDisposal.stage === 'handed-off' ? 'received' : lastDisposal.stage === 'evidence-rejected' ? 'evidence-corrected' : null;
  const advanceDisposal = () => {
    if (!nextDisposalStage) return;
    const stage = nextDisposalStage;
    const contractor = state.contractors.find((item) => item.id === contractorId);
    try {
      setState(repository.dispatch({
        id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId, stage,
        contractor: contractor?.organizationName ?? '', contractorId,
        custodyReference: caseDisposalEvents[0]?.custodyReference ?? caseDraft.custody,
        evidenceReference: ['received', 'evidence-corrected'].includes(stage) ? caseDraft.evidence.trim() : caseDraft.evidence.trim() ? `${caseDraft.evidence.trim()}-${stage}` : '',
        ...(['received', 'evidence-corrected'].includes(stage) ? { certificateReference: caseDraft.certificate.trim() } : {}),
        reason: null, actor: 'Operations assurance',
        occurredOn: stage === 'evidence-corrected' ? lastDisposal?.occurredOn.slice(0, 10) ?? '2026-10-22' : custodyReadiness && ['handed-off', 'received'].includes(stage) ? custodyReadiness.plan.scheduledOn : '2026-10-22',
      }));
      setMessage(stage === 'evidence-corrected' ? 'Corrected certificate submitted; independent review remains required.' : `Disposal custody advanced to ${stage}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Disposal custody update failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  const reviewCertificate = (decision: 'accept' | 'return') => {
    if (!lastDisposal) return;
    try {
      setState(repository.dispatch({
        id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: custodyCaseId,
        expectedEvidenceEventId: lastDisposal.id, decision, certificateReference: caseDraft.certificate,
        evidenceReference: caseDraft.reviewEvidence ?? '', reason: caseDraft.reviewReason ?? '',
        reviewedBy: 'Independent disposal reviewer', reviewedOn: lastDisposal.occurredOn.slice(0, 10),
      }));
      setMessage(decision === 'accept' ? 'Exact disposal certificate independently accepted; case reconciliation may now close.' : 'Disposal certificate returned; correct the evidence without changing prior custody history.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Disposal certificate review failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  const close = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          caseId: custodyCaseId,
          customerAcknowledgement: caseDraft.acknowledgement,
          disposalCertificate: caseDraft.certificate,
          billingAdjustmentReference: caseDraft.billing,
          paymentPlanReference: caseDraft.payment,
          fieldActionsOpen: 0,
          reviewedBy: "Operations assurance",
          closedOn: caseDisposalEvents.at(-1)?.occurredOn.slice(0, 10) ?? "2026-10-22",
        }),
      );
      setMessage(
        "Meter case closed after customer and physical-custody reconciliation.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Meter closure failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  return (
    <section className="card" aria-label="Meter operations workload">
      <h2>Customer and field workload</h2>
      <label>
        Workload role
        <select
          value={role}
          onChange={(event) => {
            setRole(event.target.value as MeterWorkloadRole);
          }}
        >
          <option>Operations Viewer</option>
          <option>Operations Supervisor</option>
        </select>
      </label>
      <p aria-label="Selected meter source">{custodyCaseId} · account {selectedCase?.accountId ?? 'missing source'} · meter {selectedCase?.meterSerial ?? 'missing source'} · field {selectedCase?.fieldOwner} · customer {selectedCase?.customerOwner}</p>
      <fieldset><legend>Selected case recovery evidence</legend><label>Follow-up contact or field evidence<textarea value={caseDraft.contact} onChange={(event) => { updateCaseDraft({ ...caseDraft, contact: event.target.value }); }} /></label><label>Selected case recovery reason<textarea value={caseDraft.reason} onChange={(event) => { updateCaseDraft({ ...caseDraft, reason: event.target.value }); }} /></label><label>Case custody consignment<input value={caseDisposalEvents[0]?.custodyReference ?? caseDraft.custody} disabled={caseDisposalEvents.length > 0} onChange={(event) => { updateCaseDraft({ ...caseDraft, custody: event.target.value }); }} /></label><label>Case disposal evidence reference<input value={caseDraft.evidence} onChange={(event) => { updateCaseDraft({ ...caseDraft, evidence: event.target.value }); }} /></label><label>Case customer acknowledgement<input value={caseDraft.acknowledgement} onChange={(event) => { updateCaseDraft({ ...caseDraft, acknowledgement: event.target.value }); }} /></label><label>Case disposal certificate<input value={caseDraft.certificate} onChange={(event) => { updateCaseDraft({ ...caseDraft, certificate: event.target.value }); }} /></label><label>Case billing reconciliation<input value={caseDraft.billing} onChange={(event) => { updateCaseDraft({ ...caseDraft, billing: event.target.value }); }} /></label><label>Case payment arrangement<input value={caseDraft.payment} onChange={(event) => { updateCaseDraft({ ...caseDraft, payment: event.target.value }); }} /></label></fieldset>
      <button onClick={() => { setState(repository.read()); setMessage('Selected meter case refreshed; its recovery evidence draft is preserved.'); }}>Refresh selected meter case</button>
      {workload.map((item) => (
        <p key={item.caseId}>
          {item.caseId} · {item.priority} · {item.blockers.join(", ")} ·{" "}
          {item.nextAction} · field {item.fieldOwner} · customer{" "}
          {item.customerOwner} · contacts {item.contactAttempts}
        </p>
      ))}
      <section aria-label="Meter case recovery"><h3>Case recovery</h3><p>Capture one meter case with its customer, custody, contractor, billing, and closure evidence.</p><button disabled={role !== 'Operations Supervisor'} onClick={captureRecovery}>Capture selected case recovery snapshot</button><label>Import meter case archive<input type="file" accept="application/json,.json" onChange={(event) => { void importRecovery(event.target.files?.[0]); }} /></label>{recoverySnapshot && <><p aria-label="Meter recovery preview">Snapshot {recoverySnapshot.id} · case {recoverySnapshot.caseId} · created {recoverySnapshot.createdOn} · source revision {String(recoverySnapshot.sourceRevision)} · current revision {String(state.revision)} · {recoveryPreview?.ready ? 'verified for restore' : 'restore blocked'}</p>{recoveryPreview?.reasons.map((reason) => <p role="alert" key={reason}>{reason}</p>)}<a download={`meter-case-${recoverySnapshot.caseId}-${recoverySnapshot.id}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(recoverySnapshot, null, 2))}`}>Download case archive</a><button disabled={role !== 'Operations Supervisor' || !recoveryPreview?.ready} onClick={restoreRecovery}>Restore verified meter case</button></>}</section>
      <button
        disabled={
          role !== "Operations Supervisor" || caseFollowUps.length > 0 || caseClosures.length > 0
        }
        onClick={coordinate}
      >
        {workload.find((item) => item.caseId === custodyCaseId)?.priority === "urgent" ? "Coordinate urgent meter follow-up" : "Coordinate field custody follow-up"}
      </button>
      <label>Eligible disposal contractor<select value={contractorId} onChange={(event) => { setContractorId(event.target.value); }}>{state.contractors.map((item) => <option key={item.id} value={item.id} disabled={!item.active || item.authorizationStatus !== "authorized"}>{item.organizationName} · {item.active ? item.authorizationStatus : "inactive"}</option>)}</select></label>
      {selectedContractor && <p aria-label="Contractor certification readiness">{selectedContractor.organizationName} · certification expires {selectedContractor.certificationExpiresOn} · {contractorEligibility(selectedContractor, "2026-10-22").eligible ? "eligible" : "not eligible"} · {contractorEligibility(selectedContractor, "2026-11-15").expiringSoon ? "renewal due soon" : "renewal not due"}</p>}
      <label>New certification expiry<input type="date" value={certificationExpiresOn} onChange={(event) => { setCertificationExpiresOn(event.target.value); }} /></label>
      <button disabled={role !== "Operations Supervisor"} onClick={() => { updateCertification(true); }}>Renew contractor authorization</button>
      <button disabled={role !== "Operations Supervisor" || !selectedContractor?.active} onClick={() => { updateCertification(false); }}>Suspend contractor authorization</button>
      <ol aria-label="Contractor authorization history">{state.contractorHistory.map((item) => <li key={item.id}>{item.contractorId} · {item.active ? "renewed" : "suspended"} · {item.actor} · {item.changedOn} · {item.reason}</li>)}</ol>
      <label>Certification impact contractor<select value={impactContractorId} onChange={(event) => { setImpactContractorId(event.target.value); }}>{state.contractors.map((item) => <option key={item.id} value={item.id}>{item.organizationName}</option>)}</select></label>
      <label>Custody case<select value={custodyCaseId} onChange={(event) => { const id = event.target.value; setCustodyCaseId(id); localStorage.setItem('gridloom:meter-selected-case:v1', id); const plan = plannedCustodyReadiness(state, id); const priorContractor = state.disposalEvents.filter((item) => item.caseId === id).at(-1)?.contractorId; setContractorId(plan?.plan.contractorId ?? priorContractor ?? 'CONTRACTOR-CMS'); setHandoffOn(plan?.plan.scheduledOn ?? '2026-12-01'); setMessage('Case custody context loaded; other case evidence and drafts are preserved.'); }}>{state.cases.map((item) => <option key={item.caseId} value={item.caseId}>{item.caseId}</option>)}</select></label>
      <p aria-label="Custody remediation progress">{remediation.total} impacted · {remediation.reassigned} reassigned · {remediation.deferred} deferred · {remediation.unresolved} unresolved</p>
      {selectedImpact && <p aria-label="Selected custody impact">{selectedImpact.caseId} · {selectedImpact.outcome} · candidate contractors {selectedImpact.candidates.join(", ") || "none"} · original plan {selectedImpact.originalPlanId}</p>}
      <label>Case deferral reason<input value={deferralReason} onChange={(event) => { setDeferralReason(event.target.value); }} /></label>
      <label>Case review date<input type="date" value={deferralReviewOn} onChange={(event) => { setDeferralReviewOn(event.target.value); }} /></label>
      <button disabled={role !== "Operations Supervisor" || selectedImpact?.outcome !== "unresolved" || !selectedImpact.certificationEventId} onClick={deferRemediation}>Defer selected custody case</button>
      <section aria-label="Deferred custody review"><p>{pendingDeferral ? `${pendingDeferral.caseId} · owner ${pendingDeferral.owner} · review ${pendingDeferral.reviewOn} · ${'2026-10-28' >= pendingDeferral.reviewOn ? 'overdue review' : 'review scheduled'}` : 'No deferred plan awaiting review'}</p><label>Review evidence<input value={reviewEvidence} onChange={(event) => { setReviewEvidence(event.target.value); }} /></label><label>Next review date<input type="date" value={nextReviewOn} onChange={(event) => { setNextReviewOn(event.target.value); }} /></label><button disabled={role !== 'Operations Supervisor' || !pendingDeferral} onClick={() => { reviewDeferral('continue'); }}>Continue reviewed deferment</button><button disabled={role !== 'Operations Supervisor' || !pendingDeferral} onClick={() => { reviewDeferral('reassign'); }}>Review and reassign custody</button><ol aria-label="Deferred custody review history">{state.deferralReviews.map((item) => <li key={item.id}>{item.caseId} · {item.decision} · {item.reviewedBy} · {item.evidenceReference} · {item.nextReviewOn ?? item.replacementPlanId}</li>)}</ol></section>
      <ol aria-label="Custody remediation history">{state.remediationDeferrals.map((item) => <li key={item.id}>{item.caseId} · {item.reason} · review {item.reviewOn} · plan {item.affectedHandoffId} · certification {item.certificationEventId}</li>)}</ol>
      <section aria-label="Certification impact across future custody plans"><h3>Future custody impact</h3><p>{certificationImpact.filter((item) => item.status === 'blocked').length} blocked future plans · {certificationImpact.filter((item) => item.status === 'reassigned').length} reassigned · completed custody excluded</p><ol>{certificationImpact.map((item) => <li key={item.caseId}>{item.caseId} · owner {item.owner} · plan {item.originalPlanId} · {item.status} · {item.reason} · certification revision {item.certificationRevision ?? 'original'}{item.replacementContractorId ? ` · replacement ${item.replacementContractorId}` : ''}</li>)}</ol></section>
      <label>Planned custody date<input type="date" value={handoffOn} onChange={(event) => { setHandoffOn(event.target.value); }} /></label>
      <button disabled={role !== "Operations Supervisor" || (workload.find((item) => item.caseId === custodyCaseId)?.priority === "urgent" && !state.followUps.some((item) => item.caseId === custodyCaseId)) || Boolean(custodyReadiness) || state.disposalEvents.some((item) => item.caseId === custodyCaseId && item.stage === "handed-off")} onClick={planCustody}>Plan contractor custody handoff</button>
      <p aria-label="Planned custody readiness">{custodyReadiness ? `${custodyReadiness.plan.contractorId} · ${custodyReadiness.plan.scheduledOn} · ${custodyReadiness.ready ? "ready for planned handoff" : "reassignment or certification renewal required"}` : "No contractor custody handoff planned"}</p>
      <button disabled={role !== "Operations Supervisor" || !custodyReadiness?.reassignmentRequired || contractorId === custodyReadiness.plan.contractorId || state.disposalEvents.some((item) => item.caseId === custodyCaseId && item.stage === "handed-off")} onClick={reassignCustody}>Reassign ineligible planned handoff</button>
      {custodyAuthorization.authorization && <section aria-label="Pre-transfer custody authorization"><h3>Replacement custody authorization</h3><p aria-label="Custody authorization status">{custodyAuthorization.transferred ? 'Physical custody transferred; original authorization remains immutable' : custodyAuthorization.amendmentRequired ? 'Replacement plan requires independent authorization before transfer' : custodyAuthorization.amendment ? 'Replacement contractor authorized for the current plan' : 'Original custody authorization remains current'}</p>{custodyAuthorization.amendmentRequired && <><label>Custody amendment reason<input value={amendmentReason} onChange={(event) => { setAmendmentReason(event.target.value); }} /></label><label>Custody amendment approval evidence<input value={amendmentEvidence} onChange={(event) => { setAmendmentEvidence(event.target.value); }} /></label><button disabled={role !== 'Operations Supervisor' || !custodyReadiness?.ready} onClick={amendCustody}>Authorize replacement custody</button></>}<details><summary>Custody authorization amendment history ({state.custodyAmendments.filter((item) => item.caseId === custodyCaseId).length})</summary><ol aria-label="Custody authorization amendment history">{state.custodyAmendments.filter((item) => item.caseId === custodyCaseId).map((item) => <li key={item.id}>{item.previousContractorId} to {item.replacementContractorId} · {item.custodyReference} · {item.approvalEvidence} · {item.approvedBy} · {item.approvedOn} · plan {item.planId}</li>)}</ol></details></section>}
      <ol aria-label="Planned custody history">{state.plannedHandoffs.map((item) => <li key={item.id}>{item.contractorId} · {item.scheduledOn} · {item.previousHandoffId ? `reassigned from ${item.previousHandoffId}` : 'initial plan'} · {item.plannedBy}</li>)}</ol>
      {custodyReadiness?.notice && <><p aria-label="Contractor eligibility notice">Certification expires {custodyReadiness.notice.certificationExpiresOn} · {custodyReadiness.acknowledgement ? `acknowledged by ${custodyReadiness.acknowledgement.actor}` : "acknowledgement pending"}</p><button disabled={role !== "Operations Supervisor" || Boolean(custodyReadiness.acknowledgement)} onClick={acknowledgeNotice}>Acknowledge contractor risk</button></>}
      <button disabled={role !== "Operations Supervisor" || caseFollowUps.length === 0 || caseClosures.length > 0 || !nextDisposalStage} onClick={advanceDisposal}>{nextDisposalStage === 'evidence-corrected' ? 'Submit corrected disposal certificate' : 'Advance disposal custody'}</button>
      {reviewable && <fieldset><legend>Independent disposal certificate review</legend><p>Review submitted certificate {lastDisposal.certificateReference ?? 'legacy certificate not pinned'} against receipt {lastDisposal.id}. Acceptance does not replace financial or customer reconciliation.</p><label>Disposal certificate review evidence<input value={caseDraft.reviewEvidence ?? ''} onChange={(event) => { updateCaseDraft({ ...caseDraft, reviewEvidence: event.target.value }); }} /></label><label>Disposal correction reason<textarea value={caseDraft.reviewReason ?? ''} onChange={(event) => { updateCaseDraft({ ...caseDraft, reviewReason: event.target.value }); }} /></label><button disabled={role !== 'Operations Supervisor'} onClick={() => { reviewCertificate('accept'); }}>Accept disposal certificate</button><button disabled={role !== 'Operations Supervisor'} onClick={() => { reviewCertificate('return'); }}>Return disposal certificate</button></fieldset>}
      <button
        disabled={
          role !== "Operations Supervisor" ||
          caseFollowUps.length === 0 ||
          (caseDisposalEvents.length > 0 && caseDisposalEvents.at(-1)?.stage !== "confirmed") ||
          caseClosures.length > 0
        }
        onClick={close}
      >
        Close reconciled meter case
      </button>
      {message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {message}
        </p>
      )}
      <h3>Customer activity</h3>
      <ol aria-label="Meter customer activity">
        {state.operationalEvents
          .filter((item) => item.caseId === custodyCaseId && item.stream === "customer")
          .map((item) => (
            <li key={item.id}>
              {item.kind} · {item.meaning} · evidence {item.evidenceReference}
            </li>
          ))}
      </ol>
      <h3>Field and custody activity</h3>
      <ol aria-label="Meter disposal custody history">{caseDisposalEvents.map((item) => <li key={item.id}>{item.stage} · {item.contractor} · custody {item.custodyReference} · evidence {item.evidenceReference}{item.certificateReference ? ` · certificate ${item.certificateReference}` : ''}{item.reviewedEvidenceEventId ? ` · reviewed receipt ${item.reviewedEvidenceEventId}` : ''}{item.reason ? ` · reason ${item.reason}` : ''}</li>)}</ol>
      <ol aria-label="Meter field custody activity">
        {state.operationalEvents
          .filter((item) => item.caseId === custodyCaseId && item.stream === "field-custody")
          .map((item) => (
            <li key={item.id}>
              {item.kind} · {item.meaning} · evidence {item.evidenceReference}
            </li>
          ))}
      </ol>
      <ol aria-label="Meter follow-up history">
        {caseFollowUps.map((item) => (
          <li key={item.id}>
            {item.caseId} · {item.owner} · scheduled {item.scheduledOn} ·{" "}
            {item.status}
          </li>
        ))}
      </ol>
      <ol aria-label="Meter closure history">
        {caseClosures.map((item) => (
          <li key={item.id}>
            {item.caseId} · closed {item.closedOn} · custody{" "}
            {item.disposalCertificate} · customer {item.customerAcknowledgement}
          </li>
        ))}
      </ol>
    </section>
  );
}
