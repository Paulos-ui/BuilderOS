import AuthGate from "@/components/AuthGate";
import SessionBar from "@/components/SessionBar";
import ConsoleNav from "@/components/ConsoleNav";

/**
 * Single layout shell for every console page.
 *
 * The header (session bar + nav) and the page content share ONE max-width
 * container and one set of gutters. Previously each page set its own, which
 * meant the nav and the content below it sat on slightly different left
 * edges — the kind of misalignment that reads as sloppy even when nobody
 * can name what is wrong.
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
          <div className="mx-auto w-full max-w-5xl px-5 pt-6 md:px-8">
            <SessionBar />
            <ConsoleNav />
          </div>
        </header>

        <div className="mx-auto w-full max-w-5xl px-5 md:px-8">{children}</div>
      </div>
    </AuthGate>
  );
}
