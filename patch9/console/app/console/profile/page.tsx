import IdentityPanel from "@/components/IdentityPanel";

export default function ProfilePage() {
  return (
    <section className="py-10">
      <header className="mb-8">
        <p className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
          BUILDER PROFILE
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-paper">
          Your account
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim">
          How you sign in, and what BuilderScout uses to rank opportunities
          for you.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <IdentityPanel />
        <ProfileHint />
      </div>
    </section>
  );
}

function ProfileHint() {
  return (
    <section className="rounded-sm border border-line/25 bg-ink-2/50 p-5">
      <h2 className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        MATCHING SIGNAL
      </h2>
      <p className="mt-4 text-[13px] leading-relaxed text-paper-dim">
        Your feed is currently ranked by deadline because there is no profile
        signal to match against yet. Adding the chains you build on and a
        short bio switches BuilderScout to relevance ranking.
      </p>
      <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-wide text-paper-dim/50">
        PROFILE EDITING SHIPS WITH THE NEXT RELEASE — THE FEED WORKS WITHOUT
        IT, JUST LESS PERSONALLY.
      </p>
    </section>
  );
}
