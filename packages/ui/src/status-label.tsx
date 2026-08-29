import type { HTMLAttributes, ReactNode } from "react";

export type StatusTone =
  "neutral" | "working" | "success" | "warning" | "danger" | "unknown";

export type StatusLabelProps = HTMLAttributes<HTMLSpanElement> & {
  icon?: ReactNode;
  live?: boolean;
  tone?: StatusTone;
};

export const StatusLabel = ({
  children,
  className = "",
  icon,
  live = false,
  tone = "neutral",
  ...props
}: StatusLabelProps) => (
  <span
    aria-live={live ? "polite" : undefined}
    className={`serendipity-status ${className}`.trim()}
    data-tone={tone}
    {...props}
  >
    {icon === undefined ? null : (
      <span aria-hidden="true" className="serendipity-status__icon">
        {icon}
      </span>
    )}
    <span>{children}</span>
  </span>
);
