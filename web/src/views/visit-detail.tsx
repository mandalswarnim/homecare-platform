"use client";

import { Ban, CircleCheck, CloudOff, MapPinOff, Phone, Satellite, ShieldAlert, ShieldCheck, Smartphone, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { describe } from "@/components/activity-feed";
import { AssignControl } from "@/components/assign-control";
import { useConsole } from "@/components/console-data";
import { MapLegend, MapView, type MapCircle, type MapPin } from "@/components/map";
import { FlagList, StatusBadge, VerificationBadge } from "@/components/status";
import { Avatar, BackLink, Button, Card, cx, EmptyState, ErrorNote, PageHeader, Spinner } from "@/components/ui";
import { VitalsGrid } from "@/components/vitals";
import {
  errorMessage,
  formatDistance,
  formatDuration,
  formatFullDate,
  formatSeconds,
  formatTime,
  formatWhen,
  MS,
  roleLabel,
} from "@/lib/format";
import { useLiveQuery, useNow } from "@/lib/live";
import { cancelVisit, loadVisit, type VisitDetailData } from "@/lib/queries";
import type { ActivityItem, Clinician, VisitEvent, VisitFull } from "@/lib/types";
import { actualMs, eventOf, isUuid, lateMinutes, patientName, reportOf, verificationOf, visitFlags } from "@/lib/visits";

const EMPTY: VisitDetailData = { visit: null, activity: [] };

export function VisitDetailView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const valid = isUuid(id);
  const { data: consoleData, reload: reloadConsole } = useConsole();
  const query = useLiveQuery(
    `visit:${id}`,
    () => (valid ? loadVisit(id) : Promise.resolve(EMPTY)),
    valid
      ? [
          { table: "visits", filter: `id=eq.${id}` },
          { table: "visit_events", filter: `visit_id=eq.${id}` },
          { table: "activity_log", filter: `visit_id=eq.${id}` },
        ]
      : [],
  );
  const now = useNow(30_000);

  if (query.loading) return <Spinner label="Loading the visit" />;
  if (!query.data) return <ErrorNote message={query.error ?? "Couldn't load the visit."} onRetry={query.reload} />;
  const v = query.data.visit;
  if (!v) {
    return (
      <>
        <PageHeader title="Visit not found" back={<BackLink href="/visits">Visits</BackLink>} />
        <Card>
          <EmptyState icon={MapPinOff} title="This visit doesn't exist" body="It may have been removed, or the link is wrong." />
        </Card>
      </>
    );
  }

  const refresh = () => {
    query.reload();
    reloadConsole();
  };
  const verification = verificationOf(v);
  const late = lateMinutes(v);

  return (
    <>
      <PageHeader
        back={<BackLink href="/visits">Visits</BackLink>}
        title={`${v.service_type} · ${patientName(v)}`}
        subtitle={
          <>
            {formatWhen(v.scheduled_start, now)} · booked for {v.duration_minutes} min
            {v.status === "completed" && v.started_at ? ` · ${formatDuration(actualMs(v))} on site` : ""}
            {late != null && late > 15 ? ` · arrived ${late} min late` : ""}
          </>
        }
        actions={
          <>
            <StatusBadge status={v.status} />
            <VerificationBadge value={verification} flags={visitFlags(v)} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <LocationCard v={v} />
          <Card title="Visit report" subtitle={reportOf(v) ? `Recorded by ${v.clinician?.full_name ?? "the clinician"} at clock-out` : undefined}>
            {reportOf(v) ? (
              <VitalsGrid report={reportOf(v)!} />
            ) : (
              <p className="text-sm text-muted">
                {v.status === "completed" ? "No vitals were recorded for this visit." : "The clinician records vitals when they clock out."}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <PeopleCard v={v} />
          <ActionsCard v={v} clinicians={consoleData?.clinicians ?? []} onChanged={refresh} />
          <Card title="Timeline">
            <Timeline v={v} activity={query.data.activity} clinicians={consoleData?.clinicians ?? []} />
          </Card>
        </div>
      </div>
    </>
  );
}

/* ───────────────────────────── Location evidence ───────────────────────────── */

function LocationCard({ v }: { v: VisitFull }) {
  const p = v.patient;
  const home = p && p.home_lat != null && p.home_lng != null ? { lat: p.home_lat, lng: p.home_lng } : null;
  const cin = eventOf(v, "clock_in");
  const cout = eventOf(v, "clock_out");
  const pins: MapPin[] = [];
  const circles: MapCircle[] = [];

  if (home && p) {
    pins.push({ id: "home", ...home, kind: "home", label: `${patientName(v)}'s home`, sublabel: p.address ?? undefined });
    circles.push({ id: "fence", ...home, radius: p.geofence_radius_m, kind: "geofence" });
  }
  for (const e of [cin, cout]) {
    if (!e || e.lat == null || e.lng == null) continue;
    const what = e.kind === "clock_in" ? "Clock-in" : "Clock-out";
    pins.push({
      id: e.id,
      lat: e.lat,
      lng: e.lng,
      kind: e.verified ? "ok" : "flag",
      label: `${what} · ${formatTime(e.occurred_at)}`,
      sublabel: `${formatDistance(e.distance_m)} from home · GPS ±${formatDistance(e.accuracy_m)}`,
    });
    if (e.accuracy_m) circles.push({ id: `acc:${e.id}`, lat: e.lat, lng: e.lng, radius: e.accuracy_m, kind: e.verified ? "accuracy" : "accuracy-flag" });
  }

  return (
    <Card
      title="Location check"
      subtitle={
        home && p
          ? `Clock-ins count as verified inside ${p.geofence_radius_m} m of the pinned home (plus GPS margin)`
          : "The patient hasn't pinned their home, so clock-ins can't be location-verified"
      }
      bodyClassName="px-5 pt-3 pb-5"
    >
      {pins.length ? (
        <>
          <MapView
            pins={pins}
            circles={circles}
            ariaLabel="Map of the patient's home area and where the clinician clocked in and out"
            fitKey={`${v.id}:${pins.length}`}
            className="h-[300px] w-full overflow-hidden rounded-lg"
          />
          <div className="mt-3">
            <MapLegend
              items={[
                { kind: "home", label: "Pinned home (shaded: verified area)" },
                { kind: "ok", label: "Clock point · verified" },
                { kind: "flag", label: "Clock point · flagged" },
              ]}
            />
          </div>
        </>
      ) : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <EventPanel title="Clock-in" e={cin} v={v} />
        <EventPanel title="Clock-out" e={cout} v={v} />
      </div>
    </Card>
  );
}

function Check({ ok, icon, children }: { ok: boolean | null; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span className={cx("mt-0.5 shrink-0", ok === false ? "text-warning-text" : ok ? "text-good-text" : "text-muted")}>
        {icon ?? (ok === false ? <TriangleAlert className="size-3.5" aria-hidden /> : <CircleCheck className="size-3.5" aria-hidden />)}
      </span>
      <span className="text-ink-2">{children}</span>
    </li>
  );
}

function EventPanel({ title, e, v }: { title: string; e: VisitEvent | null; v: VisitFull }) {
  if (!e) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong px-4 py-3">
        <div className="text-sm font-medium text-ink">{title}</div>
        <p className="mt-1 text-[13px] text-muted">{v.status === "completed" || v.status === "in_progress" ? "Waiting for the phone to sync." : "Not yet."}</p>
      </div>
    );
  }
  const skewMin = e.device_time ? Math.round((new Date(e.device_time).getTime() - new Date(e.received_at).getTime()) / MS.MIN) : null;
  const radius = v.patient?.geofence_radius_m ?? 150;
  return (
    <div className={cx("rounded-lg border px-4 py-3", e.verified ? "border-line" : "border-warning")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-ink">
          {title} · <span className="tabular-nums">{formatSeconds(e.occurred_at)}</span>
        </span>
        {e.verified ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-good-text">
            <ShieldCheck className="size-3.5" aria-hidden /> Verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text">
            <ShieldAlert className="size-3.5" aria-hidden /> Flagged
          </span>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {e.distance_m != null ? (
          <Check ok={!e.flags.includes("outside_area")}>
            {formatDistance(e.distance_m)} from the pinned home {e.flags.includes("outside_area") ? `(outside the ${radius} m area)` : `(inside the ${radius} m area)`}
          </Check>
        ) : (
          <Check ok={false}>{e.flags.includes("no_home_pin") ? "No pinned home to compare against" : "No GPS position"}</Check>
        )}
        {e.accuracy_m != null ? (
          <Check ok={!e.flags.includes("weak_gps")} icon={e.flags.includes("weak_gps") ? undefined : <Satellite className="size-3.5" aria-hidden />}>
            GPS accurate to ±{formatDistance(e.accuracy_m)}
          </Check>
        ) : null}
        <Check ok={e.is_mocked ? false : e.is_mocked === false ? true : null} icon={e.is_mocked ? undefined : <Smartphone className="size-3.5" aria-hidden />}>
          {e.is_mocked ? "A fake-GPS app was detected on the phone" : e.is_mocked === false ? "No fake-GPS app detected" : "Phone didn't report fake-GPS status"}
          {e.platform ? ` · ${e.platform === "ios" ? "iPhone" : e.platform === "android" ? "Android" : e.platform}` : ""}
        </Check>
        {e.was_offline ? (
          <Check ok={null} icon={<CloudOff className="size-3.5" aria-hidden />}>
            Recorded without signal, synced {formatTime(e.received_at)}
          </Check>
        ) : null}
        {skewMin != null && Math.abs(skewMin) > 5 && !e.was_offline ? (
          <Check ok={false}>Phone clock was {Math.abs(skewMin)} min {skewMin > 0 ? "ahead" : "behind"}; server time used</Check>
        ) : null}
        {e.note ? <Check ok={null}>Note: {e.note}</Check> : null}
      </ul>
      {!e.verified && e.flags.length ? (
        <div className="mt-3">
          <FlagList flags={e.flags} />
        </div>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Side panels ───────────────────────────── */

function PeopleCard({ v }: { v: VisitFull }) {
  const patientPhone = v.patient?.profile?.phone;
  const c = v.clinician;
  return (
    <Card title="People">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Avatar name={patientName(v)} size={36} />
          <div className="min-w-0 flex-1">
            <Link href={`/patients/${v.patient_id}`} className="text-sm font-medium text-ink hover:underline">
              {patientName(v)}
            </Link>
            <div className="text-xs text-muted">Patient</div>
            {v.patient?.address ? <div className="mt-1 text-[13px] text-ink-2">{v.patient.address}</div> : null}
            {patientPhone ? <PhoneLink phone={patientPhone} /> : null}
          </div>
        </div>
        <div className="flex items-start gap-3 border-t border-line pt-4">
          {c ? <Avatar name={c.full_name} size={36} /> : <span className="size-9 shrink-0 rounded-full border border-dashed border-line-strong" />}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink">{c?.full_name ?? "No clinician yet"}</div>
            <div className="text-xs text-muted">{c ? `${roleLabel(c.role)}${c.specialty ? ` · ${c.specialty}` : ""}` : "Open request — any suitable clinician can accept"}</div>
            {c?.phone ? <PhoneLink phone={c.phone} /> : null}
          </div>
        </div>
        {v.reason ? (
          <div className="border-t border-line pt-4">
            <div className="text-xs text-muted">Reason given by the patient</div>
            <p className="mt-1 text-[13px] text-ink">{v.reason}</p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PhoneLink({ phone }: { phone: string }) {
  return (
    <a href={`tel:${phone.replace(/\s/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-[13px] text-brand hover:underline">
      <Phone className="size-3.5" aria-hidden /> {phone}
    </a>
  );
}

function ActionsCard({ v, clinicians, onChanged }: { v: VisitFull; clinicians: Clinician[]; onChanged: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changeable = v.status === "requested" || v.status === "accepted" || v.status === "declined";

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelVisit(v.id, reason.trim() || null);
      setConfirming(false);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Office actions">
      {!changeable ? (
        <p className="text-[13px] text-muted">
          {v.status === "cancelled"
            ? `Cancelled ${v.cancelled_at ? formatFullDate(v.cancelled_at) : ""}.`
            : v.status === "in_progress"
              ? "The clinician is on site. Visits can't be changed once they've started."
              : "Completed visits are kept as a permanent record."}
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[13px] font-medium text-ink">{v.clinician_id ? "Send to someone else" : "Send to a clinician"}</div>
            <AssignControl visit={v} clinicians={clinicians} onDone={onChanged} />
          </div>
          <div className="border-t border-line pt-4">
            {confirming ? (
              <div className="space-y-2">
                <label className="block text-[13px] font-medium text-ink" htmlFor="cancel-reason">
                  Reason (optional, shared in the record)
                </label>
                <input
                  id="cancel-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Patient admitted to hospital"
                  className="h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-faint"
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" icon={Ban} loading={busy} onClick={() => void cancel()}>
                    Cancel visit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    Keep it
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" size="sm" icon={Ban} onClick={() => setConfirming(true)}>
                Cancel this visit…
              </Button>
            )}
            {error ? <p className="mt-2 text-xs text-critical-text">{error}</p> : null}
          </div>
        </div>
      )}
    </Card>
  );
}

function Timeline({ v, activity, clinicians }: { v: VisitFull; activity: ActivityItem[]; clinicians: Clinician[] }) {
  if (activity.length === 0) return <p className="text-[13px] text-muted">Booked {formatWhen(v.created_at)}.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {activity.map((a) => {
        const line = describe(a, clinicians);
        const Icon = line.icon;
        return (
          <li key={a.id} className="relative">
            <span
              className={cx(
                "absolute top-0 -left-[31px] flex size-5 items-center justify-center rounded-full ring-4 ring-surface",
                line.warn ? "bg-warning-soft text-warning-text" : "bg-surface-2 text-ink-2",
              )}
            >
              <Icon className="size-3" aria-hidden />
            </span>
            <div className="text-[13px] text-ink">{line.text}</div>
            <div className="text-xs text-muted tabular-nums">
              {formatWhen(a.created_at)}
              {line.note ? ` · ${line.note}` : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

