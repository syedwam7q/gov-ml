import { listFleetKPIs, listModels, listActivity } from "../../_lib/api";

import { FleetView } from "./_view";

export const metadata = {
  title: "Fleet",
};

/**
 * /fleet — the default-after-login canonical view.
 *
 * Server-rendered: hits the control-plane (or mock fallback) once on the
 * server, then hands a fully-typed snapshot to the client `FleetView`
 * which subscribes to live SSE updates (Phase 5 wiring; today refreshed
 * via SWR's pollInterval).
 */
export default async function FleetPage() {
  const [models, kpis, activity] = await Promise.all([
    listModels(),
    listFleetKPIs("24h"),
    listActivity(20),
  ]);

  return <FleetView models={models} kpis={kpis} activity={activity} />;
}
