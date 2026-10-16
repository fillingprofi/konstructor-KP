import React from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300 ${className}`}>
      {(title || action) && (
        <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div className="min-w-0">
              {title && <h3 className="font-semibold text-slate-800 text-sm tracking-tight truncate">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  hint,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className="space-y-1 w-full">
      {label && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700">
          <label htmlFor={inputId}>{label}</label>
          {hint && <span className="text-[11px] text-slate-400 font-normal">{hint}</span>}
        </div>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-1.5 text-xs bg-white text-slate-900 border rounded-lg shadow-2xs transition-colors placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
          error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-slate-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
};

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const FormTextarea: React.FC<FormTextareaProps> = ({
  label,
  hint,
  error,
  className = '',
  id,
  rows = 3,
  ...props
}) => {
  const textareaId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className="space-y-1 w-full">
      {label && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700">
          <label htmlFor={textareaId}>{label}</label>
          {hint && <span className="text-[11px] text-slate-400 font-normal">{hint}</span>}
        </div>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        className={`w-full px-3 py-2 text-xs bg-white text-slate-900 border rounded-lg shadow-2xs transition-colors placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 leading-relaxed resize-y ${
          error ? 'border-red-300 bg-red-50/30' : 'border-slate-200 hover:border-slate-300'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  hint?: string;
}

export const FormSelect: React.FC<FormSelectProps> = ({
  label,
  options,
  hint,
  className = '',
  id,
  ...props
}) => {
  const selectId = id || (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className="space-y-1 w-full">
      {label && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700">
          <label htmlFor={selectId}>{label}</label>
          {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
        </div>
      )}
      <select
        id={selectId}
        className={`w-full px-3 py-1.5 text-xs bg-white text-slate-900 border border-slate-200 rounded-lg shadow-2xs transition-colors hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'sm',
  icon: Icon,
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer focus:outline-hidden';

  const sizeClasses = {
    xs: 'px-2 py-1 text-[11px] gap-1',
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-3.5 py-2 text-xs gap-2',
    lg: 'px-4 py-2.5 text-sm gap-2',
  }[size];

  const variantClasses = {
    primary:
      'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs hover:shadow-sm border border-blue-600',
    secondary:
      'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200/80',
    outline:
      'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs hover:border-slate-400',
    danger:
      'bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300',
    ghost:
      'hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-transparent',
    success:
      'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin h-3.5 w-3.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          ></path>
        </svg>
      ) : Icon ? (
        <Icon className={size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      ) : null}
      {children}
    </button>
  );
};
