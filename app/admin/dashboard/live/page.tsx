import {
  mockAdminAppointments,
  mockAdminClients,
  mockAdminRemovals,
} from "../../admin-data";
import LiveDashboardClient from "./LiveDashboardClient";

export const dynamic = "force-dynamic";

export default function AdminLiveDashboardPage() {
  return (
    <LiveDashboardClient
      appointments={mockAdminAppointments}
      clients={mockAdminClients}
      removals={mockAdminRemovals}
    />
  );
}
