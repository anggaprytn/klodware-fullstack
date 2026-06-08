import * as React from "react";
import { cn } from "@/lib/utils";

export function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700", className)}
      role="alert"
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-semibold text-slate-950", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-slate-600", className)} {...props} />;
}
