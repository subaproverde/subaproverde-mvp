import {
  mockAdminAppointments,
  mockAdminClients,
  mockAdminRemovals,
} from "../admin-data";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  return (
    <DashboardClient
      initialAppointments={mockAdminAppointments}
      clients={mockAdminClients}
      removals={mockAdminRemovals}
    />
  );
}
