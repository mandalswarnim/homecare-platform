"use client";

import { Send } from "lucide-react";
import { useId, useState } from "react";

import { errorMessage, roleLabel } from "@/lib/format";
import { assignVisit } from "@/lib/queries";
import { canDeliver } from "@/lib/services";
import type { Clinician, VisitFull } from "@/lib/types";

import { Button } from "./ui";

/**
 * Send a visit to a specific clinician (assign_visit RPC). The clinician then gets the request
 * on their phone and accepts it. Clinicians who can deliver the service are listed first; the
 * one who declined (or is currently holding it) is left out.
 */
export function AssignControl({ visit, clinicians, onDone }: { visit: VisitFull; clinicians: Clinician[]; onDone?: () => void }) {
  const id = useId();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const others = clinicians.filter((c) => c.id !== visit.clinician_id);
  const suited = others.filter((c) => canDeliver(c, visit.service_type));
  const rest = others.filter((c) => !canDeliver(c, visit.service_type));

  async function assign() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      await assignVisit(visit.id, choice);
      setSentTo(clinicians.find((c) => c.id === choice)?.full_name ?? "the clinician");
      setChoice("");
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) return <p className="text-[13px] text-good-text">Sent to {sentTo} — waiting for them to accept.</p>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="sr-only">
          Assign to
        </label>
        <select
          id={id}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="h-8 max-w-56 rounded-lg border border-line-strong bg-surface px-2 text-[13px] text-ink"
        >
          <option value="">Choose a clinician…</option>
          {suited.length ? (
            <optgroup label={`Can do ${visit.service_type.toLowerCase()}`}>
              {suited.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} · {roleLabel(c.role)}
                </option>
              ))}
            </optgroup>
          ) : null}
          {rest.length ? (
            <optgroup label="Others">
              {rest.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} · {roleLabel(c.role)}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <Button size="sm" variant="primary" icon={Send} disabled={!choice} loading={busy} onClick={() => void assign()}>
          Assign
        </Button>
      </div>
      {error ? <p className="text-xs text-critical-text">{error}</p> : null}
    </div>
  );
}
