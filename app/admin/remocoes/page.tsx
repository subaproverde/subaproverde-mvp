import {
  mockAdminClients,
  mockAdminRemovals,
} from "../admin-data";
import RemocoesClient from "./RemocoesClient";

export const dynamic = "force-dynamic";

export default function AdminRemocoesPage() {
  return (
    <RemocoesClient
      initialClients={mockAdminClients}
      initialRemovals={mockAdminRemovals}
    />
  );
}
