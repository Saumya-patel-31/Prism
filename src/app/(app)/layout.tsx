import { Sidebar } from "@/components/layout/Sidebar";
import { DemoBoot } from "@/components/demo/DemoBoot";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-full flex flex-col lg:flex-row">
      <Sidebar />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        <DemoBoot />
        <main id="main" className="flex-1 min-w-0 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
