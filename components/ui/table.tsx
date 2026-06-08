import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = ({ className, ...props }: React.ComponentProps<"table">) => (
  <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
);

export const TableHeader = ({ className, ...props }: React.ComponentProps<"thead">) => (
  <thead className={cn("[&_tr]:border-b", className)} {...props} />
);

export const TableBody = ({ className, ...props }: React.ComponentProps<"tbody">) => (
  <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

export const TableRow = ({ className, ...props }: React.ComponentProps<"tr">) => (
  <tr
    className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50", className)}
    {...props}
  />
);

export const TableHead = ({ className, ...props }: React.ComponentProps<"th">) => (
  <th
    className={cn("h-10 px-3 text-left align-middle text-xs font-semibold uppercase text-slate-500", className)}
    {...props}
  />
);

export const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => (
  <td className={cn("px-3 py-3 align-middle text-slate-700", className)} {...props} />
);
