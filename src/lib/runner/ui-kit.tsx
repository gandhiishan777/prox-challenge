'use client';

/**
 * shadcn-lite: a zero-dependency approximation of shadcn/ui.
 *
 * Injected into the sandboxed artifact iframe; resolves imports like
 * `@/components/ui/card`. Constraints that shaped every choice here:
 *   - No Radix, no cva, no clsx, no tailwind-merge. Plain React + Tailwind.
 *   - Tailwind v3 CORE utilities only (the sandbox runs the browser JIT build), so
 *     no arbitrary values (`h-[600px]`) and no arbitrary variants (`[&>svg]:...`).
 *   - The sandbox page is light, so the neutral palette is hard-coded to slate.
 *   - Model-generated code is sloppy: nothing may require props to render, and
 *     unknown variant/size strings must fall back rather than crash.
 */

import * as React from 'react';

type ClassValue = string | false | null | undefined;

/** Tiny clsx stand-in. No conflict resolution -- later classes just win in CSS order. */
function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Variant lookup with a graceful fallback for unknown/undefined keys. */
function pick(map: Record<string, string>, key: string | undefined, fallback: string): string {
  return (key && map[key]) || map[fallback] || '';
}

const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ring-offset-white';

// ---------------------------------- Card ----------------------------------

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cx('rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm', className)} {...props} />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx('flex flex-col space-y-1.5 p-6', className)} {...props} />,
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cx('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />,
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => <p ref={ref} className={cx('text-sm text-slate-500', className)} {...props} />,
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx('p-6 pt-0', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx('flex items-center p-6 pt-0', className)} {...props} />,
);
CardFooter.displayName = 'CardFooter';

// --------------------------------- Button ---------------------------------

const BUTTON_VARIANTS: Record<string, string> = {
  default: 'bg-slate-900 text-white hover:bg-slate-800',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  outline: 'border border-slate-200 bg-white text-slate-900 hover:bg-slate-100',
  ghost: 'text-slate-900 hover:bg-slate-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  link: 'text-slate-900 underline-offset-4 hover:underline',
};

const BUTTON_SIZES: Record<string, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 px-3',
  lg: 'h-11 px-8',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type || 'button'}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors',
        RING,
        'disabled:pointer-events-none disabled:opacity-50',
        pick(BUTTON_VARIANTS, variant, 'default'),
        pick(BUTTON_SIZES, size, 'default'),
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';

// -------------------------- Input / Textarea / Label ----------------------

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type || 'text'}
      className={cx(
        'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500',
        RING,
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** Height comes from `rows`, since shadcn's `min-h-[80px]` is an arbitrary value. */
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows || 3}
      className={cx(
        'flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500',
        RING,
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cx('text-sm font-medium leading-none text-slate-900', className)} {...props} />
  ),
);
Label.displayName = 'Label';

// ---------------------------------- Badge ---------------------------------

const BADGE_VARIANTS: Record<string, string> = {
  default: 'border-transparent bg-slate-900 text-white',
  secondary: 'border-transparent bg-slate-100 text-slate-900',
  outline: 'border-slate-200 text-slate-900',
  destructive: 'border-transparent bg-red-600 text-white',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cx(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        pick(BADGE_VARIANTS, variant, 'default'),
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------- Alert ---------------------------------

const ALERT_VARIANTS: Record<string, string> = {
  default: 'border-slate-200 bg-white text-slate-900',
  destructive: 'border-red-200 bg-red-50 text-red-700',
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
  /** Real shadcn positions the icon with `[&>svg]` selectors; we use a flex slot. */
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={cx('relative flex w-full gap-3 rounded-lg border p-4 text-sm', pick(ALERT_VARIANTS, variant, 'default'), className)}
      {...props}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  ),
);
Alert.displayName = 'Alert';

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h5 ref={ref} className={cx('mb-1 font-medium leading-none tracking-tight', className)} {...props} />,
);
AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cx('text-sm leading-relaxed', className)} {...props} />,
);
AlertDescription.displayName = 'AlertDescription';

// ------------------------------ Separator ---------------------------------

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cx('shrink-0 bg-slate-200', orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full', className)}
      {...props}
    />
  ),
);
Separator.displayName = 'Separator';

// ------------------------------- Progress ---------------------------------

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorClassName?: string;
}

export function Progress({ className, value, max, indicatorClassName, ...props }: ProgressProps) {
  const ceiling = typeof max === 'number' && max > 0 ? max : 100;
  const raw = typeof value === 'number' && isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(100, (raw / ceiling) * 100));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cx('relative h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
      {...props}
    >
      {/* Inline style is correct here: the fill width is dynamic, not a design token. */}
      <div className={cx('h-full rounded-full bg-slate-900 transition-all', indicatorClassName)} style={{ width: pct + '%' }} />
    </div>
  );
}

// -------------------------------- Slider ----------------------------------

function firstNumber(v: number | number[] | undefined): number | undefined {
  if (Array.isArray(v)) return typeof v[0] === 'number' ? v[0] : undefined;
  return typeof v === 'number' ? v : undefined;
}

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> {
  value?: number | number[];
  defaultValue?: number | number[];
  onValueChange?: (value: number[]) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

/**
 * Real shadcn's Slider is array-based (`value={[50]}`, `onValueChange={([v]) => ...}`),
 * and generated code writes it both ways -- array AND plain number. So we normalize an
 * incoming array down to its first element for the native `<input type="range">`, and
 * always emit an array to `onValueChange` (with `onChange` passed through as well).
 */
export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, min, max, step, onValueChange, onChange, ...props }, ref) => {
    const lo = typeof min === 'number' ? min : 0;
    const hi = typeof max === 'number' ? max : 100;
    const controlled = firstNumber(value);
    const [internal, setInternal] = React.useState<number>(firstNumber(defaultValue) ?? lo);
    const current = controlled !== undefined ? controlled : internal;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = Number(event.target.value);
      if (controlled === undefined) setInternal(next);
      if (onValueChange) onValueChange([next]);
      if (onChange) onChange(event);
    };

    return (
      <input
        ref={ref}
        type="range"
        min={lo}
        max={hi}
        step={typeof step === 'number' || typeof step === 'string' ? step : 1}
        value={current}
        onChange={handleChange}
        className={cx('w-full cursor-pointer accent-slate-900 disabled:cursor-not-allowed disabled:opacity-50', RING, className)}
        {...props}
      />
    );
  },
);
Slider.displayName = 'Slider';

// -------------------------------- Switch ----------------------------------

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * A real (visually hidden) checkbox for form + a11y semantics, with track and thumb
 * driven by React state -- `peer-checked:` can't reach the nested thumb element.
 */
export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const [internal, setInternal] = React.useState<boolean>(!!defaultChecked);
    const isOn = checked !== undefined ? !!checked : internal;

    return (
      <label className={cx('inline-flex shrink-0 items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer', className)}>
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className="sr-only"
          checked={isOn}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.checked;
            if (checked === undefined) setInternal(next);
            if (onCheckedChange) onCheckedChange(next);
          }}
          {...props}
        />
        <span className={cx('inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors', isOn ? 'bg-slate-900' : 'bg-slate-200')}>
          <span className={cx('pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform', isOn ? 'translate-x-5' : 'translate-x-0')} />
        </span>
      </label>
    );
  },
);
Switch.displayName = 'Switch';

// ------------------- Select (+ compositional compat shims) ----------------

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  onValueChange?: (value: string) => void;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}

/**
 * Best-effort compatibility layer, not a Radix port. Generated code writes the shadcn
 * composition:
 *
 *   <Select onValueChange={...}>
 *     <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
 *     <SelectContent><SelectItem value="a">A</SelectItem></SelectContent>
 *   </Select>
 *
 * We render a native <select>, so `SelectItem` becomes an <option>, `SelectContent`
 * transparently renders its options, and `SelectTrigger`/`SelectValue` render null --
 * they would otherwise inject non-<option> nodes into a <select> and break the DOM.
 * Plain `<Select><option/></Select>` usage keeps working unchanged.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, onValueChange, onChange, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cx(
        'flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
        RING,
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      onChange={(event) => {
        if (onValueChange) onValueChange(event.target.value);
        if (onChange) onChange(event);
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function SelectTrigger(_props: React.HTMLAttributes<HTMLElement>) {
  return null;
}

export function SelectValue(_props: React.HTMLAttributes<HTMLElement> & { placeholder?: string }) {
  return null;
}

export function SelectContent({ children }: React.HTMLAttributes<HTMLElement>) {
  return <>{children}</>;
}

export interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {
  value?: string;
}

export function SelectItem({ value, children, ...props }: SelectItemProps) {
  return (
    <option value={value} {...props}>
      {children}
    </option>
  );
}

// --------------------------------- Tabs -----------------------------------

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({ value: '', setValue: () => {} });

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

/** Finds the first TabsTrigger value so code that omits `defaultValue` still renders. */
function firstTriggerValue(node: React.ReactNode, depth = 0): string | undefined {
  if (depth > 6) return undefined;
  let found: string | undefined;
  React.Children.forEach(node, (child) => {
    if (found || !React.isValidElement(child)) return;
    const p = child.props as { value?: string; children?: React.ReactNode };
    if (child.type === TabsTrigger && typeof p.value === 'string') found = p.value;
    else found = firstTriggerValue(p.children, depth + 1);
  });
  return found;
}

export function Tabs({ className, defaultValue, value, onValueChange, children, ...props }: TabsProps) {
  const [internal, setInternal] = React.useState<string>(() => defaultValue ?? firstTriggerValue(children) ?? '');
  const active = value !== undefined ? value : internal;
  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      if (onValueChange) onValueChange(next);
    },
    [value, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value: active, setValue }}>
      <div className={cx(className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cx('inline-flex h-10 items-center justify-center gap-1 rounded-md bg-slate-100 p-1 text-slate-500', className)}
      {...props}
    />
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value?: string;
}

export function TabsTrigger({ className, value, onClick, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  const isActive = value !== undefined && ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      className={cx(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        RING,
        'disabled:pointer-events-none disabled:opacity-50',
        isActive ? 'bg-white text-slate-900 shadow-sm' : 'hover:text-slate-900',
        className,
      )}
      onClick={(event) => {
        if (value !== undefined) ctx.setValue(value);
        if (onClick) onClick(event);
      }}
      {...props}
    />
  );
}

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
}

export function TabsContent({ className, value, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (value === undefined || ctx.value !== value) return null;
  return <div role="tabpanel" className={cx('mt-2', RING, className)} {...props} />;
}

// --------------------------------- Table ----------------------------------

export const Table = React.forwardRef<HTMLTableElement, React.TableHTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cx('w-full text-sm text-slate-900', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cx('border-b border-slate-200', className)} {...props} />,
);
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cx(className)} {...props} />,
);
TableBody.displayName = 'TableBody';

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cx('border-b border-slate-200 transition-colors hover:bg-slate-50', className)} {...props} />
  ),
);
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th ref={ref} className={cx('h-10 px-4 py-2 text-left align-middle font-medium text-slate-500', className)} {...props} />
  ),
);
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cx('px-4 py-2 align-middle', className)} {...props} />,
);
TableCell.displayName = 'TableCell';

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => <caption ref={ref} className={cx('mt-4 text-sm text-slate-500', className)} {...props} />,
);
TableCaption.displayName = 'TableCaption';

// ------------------------------- Scope map --------------------------------

export const UI_KIT = {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter,
  Button, Input, Textarea, Label, Badge,
  Alert, AlertTitle, AlertDescription,
  Separator, Progress, Slider, Switch,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption,
};
