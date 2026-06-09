import { mockAdminClients } from "../../admin-data";
import WorkstationClient from "./WorkstationClient";

export const dynamic = "force-dynamic";

export default function AdminRemocoesEstacaoPage() {
  return <WorkstationClient initialClients={mockAdminClients} />;
}
