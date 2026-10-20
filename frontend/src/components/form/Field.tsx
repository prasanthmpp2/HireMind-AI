import { ReactNode } from "react";

type FieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
};

export const Field = ({ label, required, error, children }: FieldProps) => (
  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300">
    <span>
      {label}
      {required ? <span className="text-rose-500"> *</span> : null}
    </span>
    <div className="mt-2">{children}</div>
    {error ? <span className="mt-1 block text-xs text-rose-500">{error}</span> : null}
  </label>
);
