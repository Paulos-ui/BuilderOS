import AuthGate from "@/components/AuthGate";
import ConsoleSidebar from "@/components/ConsoleSidebar";

/**
 * Console shell: persistent rail on the left, work area on the right.
 *
 * The rail replaces the previous horizontal tab strip. Beyond looking more
 * settled, it means navigation no longer competes for the same horizontal
 * space as page content, and adding a seventh destination later does not
 * require rethinking the header.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-ink lg:flex">
        <ConsoleSidebar />
        <main className="bp-grid min-w-0 flex-1">
          <div className="mx-auto w-full max-w-4xl px-5 md:px-8">{children}</div>
        </main>
      </div>
    </AuthGate>
  );
}
