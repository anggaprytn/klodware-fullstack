"use client";

import { ErrorState } from "@/components/admin/ErrorState";

export default function AdminError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="admin-main">
      <ErrorState
        action={
          <button className="button secondary" onClick={reset} type="button">
            Retry
          </button>
        }
        description="The admin view could not be rendered from the current server data."
      />
    </main>
  );
}
