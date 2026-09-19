import { supabaseApiAdmin } from "@/lib/apiAuth";

export type BiaCloudCase = {
  id: string;
  title: string;
  status: "active" | "waiting" | "resolved" | "cancelled";
  facts: string;
  created_at: string;
  updated_at: string;
};

export type BiaCloudMessage = {
  id: string;
  case_id: string;
  role: "operator" | "assistant" | "system";
  body: string;
  created_at: string;
};

function cleanText(value: unknown, limit = 6000) {
  return String(value ?? "").trim().slice(0, limit);
}

function storageError(error: { code?: string; message?: string } | null) {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return "A estrutura da Bia ainda não foi aplicada ao banco de produção.";
  }
  return error?.message || "Não foi possível acessar a Central da Bia.";
}

export async function listBiaCloudCases() {
  const { data, error } = await supabaseApiAdmin
    .from("bia_cloud_cases")
    .select("id,title,status,facts,created_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(storageError(error));
  return (data ?? []) as BiaCloudCase[];
}

export async function listBiaCloudMessages(caseId: string) {
  const { data, error } = await supabaseApiAdmin
    .from("bia_cloud_messages")
    .select("id,case_id,role,body,created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true })
    .limit(120);
  if (error) throw new Error(storageError(error));
  return (data ?? []) as BiaCloudMessage[];
}

async function activeMemories() {
  const { data, error } = await supabaseApiAdmin
    .from("bia_cloud_memories")
    .select("instruction")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(storageError(error));
  return (data ?? []).map((item) => cleanText(item.instruction, 1200)).filter(Boolean);
}

async function rememberOperatorRule(message: string, userId: string) {
  // Uma orientação de caso permanece no histórico. Somente as correções que
  // Bruno expressa como regra geral devem atravessar atendimentos futuros.
  if (!/\b(?:sempre|nunca|a partir de agora|n[aã]o volte|n[aã]o retroceda)\b/i.test(message)) return;
  const instruction = cleanText(message, 1200);
  const memoryKey = `operator_${Buffer.from(instruction).toString("base64url").slice(0, 72)}`;
  const { error } = await supabaseApiAdmin
    .from("bia_cloud_memories")
    .upsert({ memory_key: memoryKey, instruction, source: "Bruno", created_by: userId, active: true }, { onConflict: "memory_key" });
  if (error) throw new Error(storageError(error));
}

export async function sendBiaCloudMessage(input: { caseId?: string; message: string; userId: string }) {
  const message = cleanText(input.message);
  if (!message) throw new Error("Escreva uma mensagem para a Bia.");

  let caseId = cleanText(input.caseId, 80);
  if (!caseId) {
    const { data, error } = await supabaseApiAdmin
      .from("bia_cloud_cases")
      .insert({ title: message.slice(0, 96) || "Novo atendimento Mercado Livre", facts: message, created_by: input.userId })
      .select("id")
      .single();
    if (error || !data) throw new Error(storageError(error));
    caseId = data.id;
  }

  const { data: caseItem, error: caseError } = await supabaseApiAdmin
    .from("bia_cloud_cases")
    .select("id,title,status,facts")
    .eq("id", caseId)
    .single();
  if (caseError || !caseItem) throw new Error("O caso selecionado não foi encontrado.");
  if (caseItem.status !== "active" && caseItem.status !== "waiting") throw new Error("Este caso está encerrado. Abra um novo atendimento para continuar.");

  const { error: messageError } = await supabaseApiAdmin
    .from("bia_cloud_messages")
    .insert({ case_id: caseId, role: "operator", body: message });
  if (messageError) throw new Error(storageError(messageError));

  await rememberOperatorRule(message, input.userId);

  const [history, memories] = await Promise.all([listBiaCloudMessages(caseId), activeMemories()]);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { caseId, reply: "A Central da Bia está publicada, mas a chave privada do modelo ainda não foi configurada no ambiente seguro do site.", configured: false };
  }

  const instructions = [
    "Você é Bia, assistente operacional da Suba Pro Verde para chamados autorizados do Mercado Livre.",
    "Bruno é o administrador autorizado desta central. Suas orientações operacionais devem ser registradas e aplicadas ao caso, sem respostas genéricas ou relatórios longos.",
    "Use linguagem cordial, direta e específica. Não invente evidências, envios, contatos, protocolos ou resultados. Não faça comunicação externa nesta conversa: prepare e registre a próxima ação.",
    "Ao tratar solicitações de atendimento humano, use somente os canais oficiais oferecidos pela plataforma. Se houver uma limitação de tela ou conector, descreva a próxima ação verificável, sem reiniciar etapas concluídas.",
    "Memórias operacionais vigentes:",
    ...memories.map((item) => `- ${item}`),
  ].join("\n");
  const context = history.slice(-20).map((item) => `${item.role === "operator" ? "Bruno" : "Bia"}: ${item.body}`).join("\n");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-5.6-terra", instructions, input: `Caso: ${caseItem.title}\nFatos iniciais: ${caseItem.facts}\n\n${context}`, store: false, text: { verbosity: "low" } }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "A Bia não conseguiu responder agora.");
  const reply = cleanText(body.output_text || "", 6000) || "Registrei sua orientação. Vou seguir a próxima etapa confirmada do caso.";
  const { error: replyError } = await supabaseApiAdmin
    .from("bia_cloud_messages")
    .insert({ case_id: caseId, role: "assistant", body: reply });
  if (replyError) throw new Error(storageError(replyError));
  await supabaseApiAdmin.from("bia_cloud_cases").update({ updated_at: new Date().toISOString() }).eq("id", caseId);
  return { caseId, reply, configured: true };
}
