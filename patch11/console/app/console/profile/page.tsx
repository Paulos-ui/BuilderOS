import IdentityPanel from "@/components/IdentityPanel";
import ProfileHeader from "@/components/ProfileHeader";

export default function ProfilePage() {
  return (
    <section className="py-10">
      <ProfileHeader />

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <IdentityPanel />
        <MatchingSignal />
      </div>
    </section>
  );
}

function MatchingSignal() {
  return (
    <section className="rounded-sm border border-line/25 bg-ink-2/50 p-5">
      <h2 className="font-mono text-[10px] tracking-[0.25em] text-line-bright">
        MATCHING SIGNAL
      </h2>
      <p className="mt-4 text-[13px] leading-relaxed text-paper-dim">
        Your feed is ranked by deadline until there is profile signal to match
        against. Adding the chains you build on and a short bio switches
        BuilderScout to relevance ranking.
      </p>
      <p className="mt-3 font-mono text-[9px] leading-relaxed tracking-wide text-paper-dim/50">
        PROFILE EDITING SHIPS WITH THE NEXT RELEASE. THE FEED WORKS WITHOUT
        IT, JUST LESS PERSONALLY.
      </p>
    </section>
  );
}
