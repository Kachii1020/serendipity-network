"use client";

import { Button } from "@serendipity/ui";
import { useEffect, useId, useRef } from "react";

export function DecisionDialog({
  cancelLabel = "Keep reviewing",
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: {
  readonly cancelLabel?: string;
  readonly confirmLabel: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly open: boolean;
  readonly title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      aria-labelledby={titleId}
      className="decision-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClose={onCancel}
      ref={dialogRef}
    >
      <p className="section-kicker">One last check</p>
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      <div>
        <Button onClick={onCancel} variant="secondary">
          {cancelLabel}
        </Button>
        <Button
          onClick={() => {
            onConfirm();
            onCancel();
          }}
          variant="primary"
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
