import { SettingsIcon } from "@aegis/ui";

import { PageStub } from "../_components/page-stub";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <PageStub
      label="Settings"
      description="Profile, notifications, team members, API tokens, and the admin-only emergency-stop toggle. Per-user preferences are stored on the Clerk user."
      arrivingIn="phase 4e"
      icon={<SettingsIcon width={24} height={24} />}
    />
  );
}
