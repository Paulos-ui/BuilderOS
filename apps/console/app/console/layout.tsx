import AuthGate from "@/components/AuthGate";
import ConsoleNav from "@/components/ConsoleNav";

/**
 * One shell for every console page. The header and page content share a
 * single max-width container and one set of gutters, so nothing sits on a
 * different left edge to anything else.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="bp-grid min-h-screen">
        <header className="border-b border-line/15">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <ConsoleNav />
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">{children}</div>
      </div>
    </AuthGate>
  );
}
