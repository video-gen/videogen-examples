type ProgressState = "pending" | "active" | "done" | "failed";

export function ProgressBar({
  label,
  percent,
  state,
}: {
  label: string;
  percent: number;
  state: ProgressState;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  const barColor =
    state === "failed"
      ? "bg-red-500"
      : state === "done"
        ? "bg-emerald-500"
        : state === "active"
          ? "bg-violet-500"
          : "bg-neutral-600";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={state === "pending" ? "text-neutral-500" : "text-neutral-300"}>
          {label}
        </span>
        <span className="tabular-nums text-neutral-400">
          {state === "done" ? "100%" : state === "pending" ? "—" : `${clamped}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${state === "done" ? 100 : state === "pending" ? 0 : clamped}%` }}
        />
      </div>
    </div>
  );
}
