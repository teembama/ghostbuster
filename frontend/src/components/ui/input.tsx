import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white",
        "placeholder:text-gb-muted outline-none transition-colors",
        "focus:border-gb-accent/50 focus:ring-1 focus:ring-gb-accent/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
