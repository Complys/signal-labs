"use client";

import * as React from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "Ended";

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);

  if (days >= 1) return `Ends in ${days}d ${hours}h`;
  if (hours >= 1) return `Ends in ${hours}h ${mins}m`;
  return `Ends in ${mins}m`;
}

export default function DealCountdown({
  endsAtIso,
  className = "",
}: {
  endsAtIso?: string | null;
  className?: string;
}) {
  const [label, setLabel] = React.useState<string>("");

  React.useEffect(() => {
    if (!endsAtIso) {
      setLabel("Limited time");
      return;
    }

    const endsAt = new Date(endsAtIso);

    const tick = () => {
      const now = new Date();
      const ms = endsAt.getTime() - now.getTime();
      setLabel(formatRemaining(ms));
    };

    tick();
    const id = setInterval(tick, 30_000); // update every 30s
    return () => clearInterval(id);
  }, [endsAtIso]);

  return <span className={className}>{label}</span>;
}
