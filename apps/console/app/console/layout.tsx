import AuthGate from "@/components/AuthGate";
import ConsoleNav from "@/components/ConsoleNav";

/**
 * Console shell.
 *
 * The header sits on its own surface — slightly lifted, with a hairline
 * beneath — so the navigation chrome reads as a distinct layer from the
 * working area below it. Previously both shared the same background and the
 * boundary was carried entirely by a single border, which made the page feel
 * like one undifferentiated sheet.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-ink">
        <header className="sticky top-0 z-30 border-b border-line/25 bg-ink-2/85 backdrop-blur-md">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <ConsoleNav />
          </div>
        </header>

        <main className="bp-grid min-h-[calc(100vh-var(--console-header,120px))]">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </AuthGate>
  );
}
