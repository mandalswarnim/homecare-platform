import type { ReactNode } from "react";

import { ConsoleDataProvider } from "@/components/console-data";
import { ConsoleGuard } from "@/components/console-guard";
import { Shell } from "@/components/shell";

// The console renders only after the browser confirms an admin session (data is protected by
// row-level security in the database), so it and each of its pages opt out of instant-navigation
// validation: there is no prerendered shell to validate.
export const instant = false;

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <ConsoleGuard>
      <ConsoleDataProvider>
        <Shell>{children}</Shell>
      </ConsoleDataProvider>
    </ConsoleGuard>
  );
}
