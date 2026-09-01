export type CrmPriorityKind = "conversation" | "task" | "receipt";

export type CrmIntelligenceSuggestion = {
  id: string;
  type: "fact" | "action";
  category: string;
  title: string;
  description: string;
  confidence: number;
  evidence: string;
  status: "pending" | "applied" | "rejected" | "superseded";
  contactName: string;
  occurredAt: string;
  decision: string;
  reason: string;
  proposedReply: string;
  model: string;
  provider: string;
  ruleIds: string[];
  decisionEvidence: Array<{ source?: string; reference?: string; excerpt?: string }>;
};

export type CrmOverview = {
  setupRequired: boolean;
  generatedAt: string;
  workspace: { id: string; name: string; slug: string } | null;
  metrics: {
    activeLeads: number;
    waitingTeam: number;
    overdueFollowUps: number;
    openReceivables: number;
  };
  pipeline: Array<{
    stage: string;
    label: string;
    count: number;
    value: number;
  }>;
  priorities: Array<{
    id: string;
    kind: CrmPriorityKind;
    contactName: string;
    title: string;
    detail: string;
    occurredAt: string | null;
    urgent: boolean;
  }>;
  recentActivities: Array<{
    id: string;
    contactName: string;
    title: string;
    description: string;
    occurredAt: string;
    activityType: string;
  }>;
  finance: {
    accounts: Array<{
      id: string;
      name: string;
      provider: string;
      integrationStatus: string;
      reconciliationMode: string;
    }>;
    receiptsToReview: number;
  };
  fiscal: {
    enabled: boolean;
    environment: string;
    provider: string | null;
  };
  intelligence: {
    observerActive: boolean;
    pendingSuggestions: number;
    runsToday: number;
    averageConfidence: number;
    totalCostUsdToday: number;
    suggestions: CrmIntelligenceSuggestion[];
  };
};
