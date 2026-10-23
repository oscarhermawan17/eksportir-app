import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export const inputClasses =
  'w-full rounded-card border border-border bg-card px-3.5 py-2.5 text-sm font-medium text-text placeholder:text-muted/70 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

/** Label above, helper text below (design system form pattern). */
export function Field({
  label,
  helper,
  required,
  id,
  ...inputProps
}: { label: string; helper?: ReactNode; id: string } & InputHTMLAttributes<HTMLInputElement>) {
  const helperId = helper ? `${id}-helper` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-text">
        {label}
        {required ? (
          <span className="text-error" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <input id={id} required={required} aria-describedby={helperId} className={inputClasses} {...inputProps} />
      {helper ? (
        <p id={helperId} className="text-xs text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function FormErrors({ messages }: { messages: string[] }) {
  if (messages.length === 0) {
    return null;
  }
  return (
    <div role="alert" className="rounded-card border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
      {messages.length === 1 ? (
        <p>{messages[0]}</p>
      ) : (
        <ul className="list-inside list-disc space-y-0.5">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldShell({
  id,
  label,
  required,
  helper,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  helper?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wider text-text">
        {label}
        {required ? (
          <span className="text-error" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {helper ? (
        <p id={`${id}-helper`} className="text-xs text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function TextareaField({
  label,
  helper,
  required,
  id,
  ...props
}: { label: string; helper?: ReactNode; id: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell id={id} label={label} required={required} helper={helper}>
      <textarea
        id={id}
        required={required}
        rows={4}
        aria-describedby={helper ? `${id}-helper` : undefined}
        className={inputClasses}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  helper,
  required,
  id,
  placeholder,
  options,
  ...props
}: {
  label: string;
  helper?: ReactNode;
  id: string;
  placeholder: string;
  options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell id={id} label={label} required={required} helper={helper}>
      <select
        id={id}
        required={required}
        aria-describedby={helper ? `${id}-helper` : undefined}
        className={inputClasses}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
