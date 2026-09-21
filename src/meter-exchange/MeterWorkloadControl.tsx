import { useRef, useState } from "react";
import { meterCaseWorkload } from "./meter-case-workload";
import {
  BrowserMeterWorkloadPersistence,
  MeterWorkloadRepository,
  type MeterDisposalStage,
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
  const feedback = useRef<HTMLParagraphElement>(null);
  const workload = meterCaseWorkload(state.cases, "2026-10-20");
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
  const advanceDisposal = () => { const stages: MeterDisposalStage[] = ["requested", "authorized", "handed-off", "received", "evidence-rejected", "evidence-corrected", "confirmed"]; const stage = stages[state.disposalEvents.length]; if (!stage) return; try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: "MX-905", stage, contractor: "Circular Meter Services", custodyReference: "CUSTODY-905", evidenceReference: `DISPOSAL-${stage}`, reason: stage === "evidence-rejected" ? "Certificate omitted the serialized meter seal reference." : null, actor: "Operations assurance", occurredOn: "2026-10-22" })); setMessage(`Disposal custody advanced to ${stage}.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Disposal custody update failed."); } queueMicrotask(() => feedback.current?.focus()); };
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
      <button
        disabled={
          role !== "Operations Supervisor" || state.followUps.length > 0
        }
        onClick={coordinate}
      >
        Coordinate urgent meter follow-up
      </button>
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
