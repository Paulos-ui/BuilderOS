import IdentityPanel from "@/components/IdentityPanel";
import ProfileHeader from "@/components/ProfileHeader";

export default function ProfilePage() {
  return (
    <section className="py-10">
      <ProfileHeader />
      <div className="mt-8">
        <IdentityPanel />
      </div>
    </section>
  );
}
