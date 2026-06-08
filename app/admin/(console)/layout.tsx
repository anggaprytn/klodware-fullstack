import { AdminConsoleLayout } from "@/components/admin/AdminConsoleLayout";

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminConsoleLayout>{children}</AdminConsoleLayout>;
}
