import { ProfileForm } from "@/components/ProfileForm";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/lessons/context";

export default async function OnboardingPage() {
  const user = await requireUser();
  const profile = await getProfile(user.id);
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white px-4 py-8">
      <div className="mx-auto max-w-xl">
        <p className="mb-6 text-slate-600">Hi <b>{user.name}</b> 👋 Let&apos;s personalise your daily lessons.</p>
        <div className="card p-5 sm:p-6">
          <ProfileForm variant="onboarding" initial={profile?.onboarded ? profile : undefined} />
        </div>
      </div>
    </div>
  );
}
