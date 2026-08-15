import AuthGate from "@/components/AuthGate";
import SessionBar from "@/components/SessionBar";

/**
 * Route-level protection for everything under /console.
 *
 * Using a layout rather than wrapping the page component means the existing
 * console page is untouched, and any future page added under /console is
 * protected automatically instead of relying on someone remembering to add
 * a guard.
 */
export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="mx-auto max-w-5xl px-5 pt-8 md:px-8">
        <SessionBar />
      </div>
      {children}
    </AuthGate>
  );
}
