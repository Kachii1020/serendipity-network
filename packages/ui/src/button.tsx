import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export const Button = ({
  className = "",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) => (
  <button
    className={`serendipity-button ${className}`.trim()}
    data-variant={variant}
    type={type}
    {...props}
  />
);
