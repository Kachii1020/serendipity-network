"use client";

import { useEffect, useRef, useState } from "react";

const remaining = (expiresAt: string): number =>
  Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1_000));

export function HoldCountdown({
  expiresAt,
  onExpired,
}: {
  readonly expiresAt: string;
  readonly onExpired: () => void;
}) {
  const [seconds, setSeconds] = useState(() => remaining(expiresAt));
  const notified = useRef(false);

  useEffect(() => {
    notified.current = false;
    const tick = () => {
      const next = remaining(expiresAt);
      setSeconds(next);
      if (next === 0 && !notified.current) {
        notified.current = true;
        onExpired();
      }
    };
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return (
    <p className="hold-countdown">
      <strong>
        {minutes}:{remainder}
      </strong>{" "}
      remaining <span aria-hidden="true">·</span> earliest hold
    </p>
  );
}
