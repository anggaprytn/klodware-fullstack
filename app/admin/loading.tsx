import { LoadingState } from "@/components/admin/LoadingState";

export default function AdminLoading() {
  return (
    <main className="admin-main">
      <LoadingState title="Loading admin console" />
    </main>
  );
}
