import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

type Depth = "raised" | "recessed" | "flat";

export function NeoSurface({
  depth = "raised",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { depth?: Depth }) {
  return (
    <div
      {...props}
      className={`neo-surface neo-${depth} ${className}`.trim()}
    />
  );
}

export function NeoButton({
  children,
  className = "",
  loading = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`neo-button ${className}`.trim()}
      aria-busy={loading || undefined}
      disabled={props.disabled || loading}
    >
      {children}
    </button>
  );
}

export function NeoIconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <NeoButton
      {...props}
      aria-label={label}
      className={`neo-icon-button ${props.className || ""}`}
    >
      {children}
    </NeoButton>
  );
}

export function NeoToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      className={`neo-toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="neo-toggle-thumb" aria-hidden="true" />
    </button>
  );
}

export function NeoSearch({
  label,
  placeholder,
  value,
  onChange,
  className = "",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`neo-search ${className}`.trim()}>
      <span className="sr-only">{label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.2 4.2" />
      </svg>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function NeoSegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  label: string;
  options: Array<{ value: T; label: string; detail?: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`neo-segmented ${className}`.trim()}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className="neo-segment"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          <span>{option.label}</span>
          {option.detail && <small>{option.detail}</small>}
        </button>
      ))}
    </div>
  );
}

export function NeoGauge({
  value,
  label,
  period,
  source,
  status,
}: {
  value?: number;
  label: string;
  period?: string;
  source?: string;
  status?: string;
}) {
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  const normalized =
    value === undefined ? undefined : Math.max(0, Math.min(100, value));
  return (
    <figure
      className="neo-gauge"
      aria-label={`${label}: ${normalized === undefined ? "sem dados" : `${normalized}%`}`}
    >
      <div className="neo-gauge-base">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="neo-gauge-channel" cx="50" cy="50" r={radius} />
          <circle
            className="neo-gauge-progress"
            cx="50"
            cy="50"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={
              normalized === undefined
                ? circumference
                : circumference * (1 - normalized / 100)
            }
          />
        </svg>
        <div className="neo-gauge-center">
          <strong>{normalized === undefined ? "—" : `${normalized}%`}</strong>
          <span>{label}</span>
        </div>
      </div>
      {(period || source || status) && (
        <figcaption>
          {period && <span>{period}</span>}
          {source && <span>{source}</span>}
          {status && <span>{status}</span>}
        </figcaption>
      )}
    </figure>
  );
}
