import { SettingsView } from "./_view";

export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  const emergencyStopActive = process.env.EMERGENCY_STOP === "true";
  return <SettingsView emergencyStopActive={emergencyStopActive} />;
}
