import ConversationsClient from "./ConversationsClient";
import CrmSectionNav from "../components/CrmSectionNav";

export const dynamic = "force-dynamic";

export default function CrmConversationsPage() {
  return <><CrmSectionNav /><ConversationsClient /></>;
}
