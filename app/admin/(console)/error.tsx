"use client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ErrorState } from "@/components/admin/ErrorState";

export default function ConsoleError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <AdminPageHeader
        title="Admin Console"
        description="The admin view could not be rendered from the current server data."
      />
      <ErrorState
        action={
          <button className="button secondary" onClick={reset} type="button">
            Retry
          </button>
        }
        description="Try again after the data source is available."
      />
    </>
  );
}
