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
  const [contractorId, setContractorId] = useState("CONTRACTOR-CMS");
  const [impactContractorId, setImpactContractorId] = useState('CONTRACTOR-CMS');
  const [custodyCaseId, setCustodyCaseId] = useState('MX-905');
  const [deferralReason, setDeferralReason] = useState('Replacement contractor evidence requires a separate case review.');
  const [deferralReviewOn, setDeferralReviewOn] = useState('2026-10-25');
  const [reviewEvidence, setReviewEvidence] = useState('Updated contractor eligibility register and planned custody reviewed.');
  const [nextReviewOn, setNextReviewOn] = useState('2026-11-02');
  const [certificationExpiresOn, setCertificationExpiresOn] = useState("2027-11-30");
  const [handoffOn, setHandoffOn] = useState("2026-12-01");
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
          caseId: "MX-905",
          owner: "Revenue recovery",
          scheduledOn: "2026-10-21",
          asOf: "2026-10-20",
          contactEvidence:
            "Customer confirmed the missed commitment by telephone.",
          escalationReason:
            "Payment and custody blockers require one accountable recovery owner.",
        }),
      );
      setMessage("Customer and field follow-up coordinated under one owner.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Meter follow-up failed.",
      );
    }
    queueMicrotask(() => feedback.current?.focus());
  };
  const advanceDisposal = () => { const stages: MeterDisposalStage[] = ["requested", "authorized", "handed-off", "received", "evidence-rejected", "evidence-corrected", "confirmed"]; const stage = stages[state.disposalEvents.length]; if (!stage) return; const contractor = state.contractors.find((item) => item.id === contractorId); try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: "MX-905", stage, contractor: contractor?.organizationName ?? "", contractorId, custodyReference: "CUSTODY-905", evidenceReference: `DISPOSAL-${stage}`, reason: stage === "evidence-rejected" ? "Certificate omitted the serialized meter seal reference." : null, actor: "Operations assurance", occurredOn: custodyReadiness && stages.indexOf(stage) >= 2 ? custodyReadiness.plan.scheduledOn : "2026-10-22" })); setMessage(`Disposal custody advanced to ${stage}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Disposal custody update failed."); } queueMicrotask(() => feedback.current?.focus()); };
  const close = () => {
    try {
      setState(
        repository.dispatch({
          id: crypto.randomUUID(),
          expectedRevision: state.revision,
          role,
          caseId: "MX-905",
          customerAcknowledgement: "ACK-905",
          disposalCertificate: "DISPOSAL-905",
          billingAdjustmentReference: "BILL-ADJ-905",
          paymentPlanReference: "PLAN-905",
          fieldActionsOpen: 0,
          reviewedBy: "Operations assurance",
          closedOn: "2026-10-22",
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
          role !== "Operations Supervisor" || state.followUps.length > 0
        }
        onClick={coordinate}
      >
        Coordinate urgent meter follow-up
      </button>
      <label>Eligible disposal contractor<select value={contractorId} onChange={(event) => { setContractorId(event.target.value); }}>{state.contractors.map((item) => <option key={item.id} value={item.id} disabled={!item.active || item.authorizationStatus !== "authorized"}>{item.organizationName} · {item.active ? item.authorizationStatus : "inactive"}</option>)}</select></label>
      {selectedContractor && <p aria-label="Contractor certification readiness">{selectedContractor.organizationName} · certification expires {selectedContractor.certificationExpiresOn} · {contractorEligibility(selectedContractor, "2026-10-22").eligible ? "eligible" : "not eligible"} · {contractorEligibility(selectedContractor, "2026-11-15").expiringSoon ? "renewal due soon" : "renewal not due"}</p>}
      <label>New certification expiry<input type="date" value={certificationExpiresOn} onChange={(event) => { setCertificationExpiresOn(event.target.value); }} /></label>
      <button disabled={role !== "Operations Supervisor"} onClick={() => { updateCertification(true); }}>Renew contractor authorization</button>
      <button disabled={role !== "Operations Supervisor" || !selectedContractor?.active} onClick={() => { updateCertification(false); }}>Suspend contractor authorization</button>
      <ol aria-label="Contractor authorization history">{state.contractorHistory.map((item) => <li key={item.id}>{item.contractorId} · {item.active ? "renewed" : "suspended"} · {item.actor} · {item.changedOn} · {item.reason}</li>)}</ol>
      <label>Certification impact contractor<select value={impactContractorId} onChange={(event) => { setImpactContractorId(event.target.value); }}>{state.contractors.map((item) => <option key={item.id} value={item.id}>{item.organizationName}</option>)}</select></label>
      <label>Custody case<select value={custodyCaseId} onChange={(event) => { setCustodyCaseId(event.target.value); }}>{state.cases.filter((item) => item.disposalEvidence !== "valid").map((item) => <option key={item.caseId} value={item.caseId}>{item.caseId}</option>)}</select></label>
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
      <button disabled={role !== "Operations Supervisor" || state.followUps.length === 0 || state.disposalEvents.at(-1)?.stage === "confirmed"} onClick={advanceDisposal}>Advance disposal custody</button>
      <button
        disabled={
          role !== "Operations Supervisor" ||
          state.followUps.length === 0 ||
          (state.disposalEvents.length > 0 && state.disposalEvents.at(-1)?.stage !== "confirmed") ||
          state.closures.length > 0
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
          .filter((item) => item.stream === "customer")
          .map((item) => (
            <li key={item.id}>
              {item.kind} · {item.meaning} · evidence {item.evidenceReference}
            </li>
          ))}
      </ol>
      <h3>Field and custody activity</h3>
      <ol aria-label="Meter disposal custody history">{state.disposalEvents.map((item) => <li key={item.id}>{item.stage} · {item.contractor} · custody {item.custodyReference} · evidence {item.evidenceReference}</li>)}</ol>
      <ol aria-label="Meter field custody activity">
        {state.operationalEvents
          .filter((item) => item.stream === "field-custody")
          .map((item) => (
            <li key={item.id}>
              {item.kind} · {item.meaning} · evidence {item.evidenceReference}
            </li>
          ))}
      </ol>
      <ol aria-label="Meter follow-up history">
        {state.followUps.map((item) => (
          <li key={item.id}>
            {item.caseId} · {item.owner} · scheduled {item.scheduledOn} ·{" "}
            {item.status}
          </li>
        ))}
      </ol>
      <ol aria-label="Meter closure history">
        {state.closures.map((item) => (
          <li key={item.id}>
            {item.caseId} · closed {item.closedOn} · custody{" "}
            {item.disposalCertificate} · customer {item.customerAcknowledgement}
          </li>
        ))}
      </ol>
    </section>
  );
}
