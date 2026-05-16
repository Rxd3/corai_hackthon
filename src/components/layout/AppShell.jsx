import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { RightPanel } from "./RightPanel";
import { MobileNav } from "./MobileNav";

export function AppShell({ activePage, onNavigate, children, rightPanel, user, onLogout }) {
  return (
    <div className="min-h-screen bg-shell px-3 py-4 text-ink sm:px-6 sm:py-7">
      <div className="mx-auto flex min-h-[850px] w-full max-w-[1440px] overflow-hidden rounded-[32px] bg-app shadow-soft lg:w-[92vw]">
        <Sidebar activePage={activePage} onNavigate={onNavigate} onLogout={onLogout} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav activePage={activePage} onNavigate={onNavigate} onLogout={onLogout} />
          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-7">
            <TopBar user={user} />
            <div className="flex flex-col gap-6 xl:flex-row">
              <section className="min-w-0 flex-1">{children}</section>
              <RightPanel>{rightPanel}</RightPanel>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
