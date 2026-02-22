"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import MlConnectCard from "./MlConnectCard";

type Complaint = {
  id: string;
  ml_case_id: string;
  reason: string | null;
  status: string | null;
  impact_level: string | null;
  is_defensible: boolean | null;
  synced_at: string | null;
};

type CaseRow = {
  id: string;
  status: "novo" | "em_analise" | "chamado_aberto" | "resolvido" | "negado";
  protocol_number: string | null;
  complaint_id: string | null;
  created_at: string | null;
};

type SellerAccountRow = {
  id: string;
  owner_user_id: string;
  seller_id: string;
  nickname: string | null;
  created_at: string | null;
};

export default function SellerDetailsPage() {
  const params = useParams();
  const sellerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("");
  const [allowed, setAllowed] = useState<boolean>(false);
  const [sellerAccount, setSellerAccount] = useState<SellerAccountRow | null>(null);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);

  const caseByComplaintId = useMemo(() => {
    const map = new Map<string, CaseRow>();
    for (const cs of cases) {
      if (cs.complaint_id) map.set(cs.complaint_id, cs);
    }
    return map;
  }, [cases]);

  async function loadAll() {
    setLoading(true);
    setMsg(null);

    try {
      // 0) auth
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!user) {
        setUserId("");
        setAllowed(false);
        setSellerAccount(null);
        setComplaints([]);
        setCases([]);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      // 0.5) is admin?
      let isAdmin = false;
      {
        const { data: isAdminData, error: isAdminErr } = await supabase.rpc("is_admin");
        if (isAdminErr) {
          // se der erro aqui, não trava o app — só considera não-admin
          console.warn("rpc(is_admin) erro:", isAdminErr.message);
          isAdmin = false;
        } else {
          isAdmin = !!isAdminData;
        }
      }

      // 1) seller_accounts (pega o MAIS RECENTE — evita erro se tiver duplicados)
      const { data: sa, error: saErr } = await supabase
        .from("seller_accounts")
        .select("id, owner_user_id, seller_id, nickname, created_at")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<SellerAccountRow>();

      if (saErr) {
        setAllowed(false);
        setSellerAccount(null);
        setMsg(saErr.message);
        setLoading(false);
        return;
      }

      // 1.1) Permissão:
      // - Admin: sempre pode
      // - Não-admin: pode se for owner_user_id OU estiver na seller_users
      if (!isAdmin) {
        const ownerOk = !!sa && sa.owner_user_id === user.id;

        // fallback (multi-user): seller_users
        const { data: su, error: suErr } = await supabase
          .from("seller_users")
          .select("seller_id")
          .eq("user_id", user.id)
          .eq("seller_id", sellerId)
          .maybeSingle();

        if (suErr) {
          setAllowed(false);
          setSellerAccount(null);
          setMsg(suErr.message);
          setLoading(false);
          return;
        }

        const linkedOk = !!su;

        if (!ownerOk && !linkedOk) {
          setAllowed(false);
          setSellerAccount(null);
          setComplaints([]);
          setCases([]);
          setLoading(false);
          return;
        }
      }

      // ✅ passou
      setAllowed(true);
      setSellerAccount(sa ?? null);

      // 2) Reclamações do seller
      const { data: complaintsData, error: complaintsError } = await supabase
        .from("complaints")
        .select("id,ml_case_id,reason,status,impact_level,is_defensible,synced_at")
        .eq("seller_id", sellerId)
        .order("synced_at", { ascending: false });

      if (complaintsError) {
        setMsg(complaintsError.message);
        setComplaints([]);
        setLoading(false);
        return;
      }

      setComplaints((complaintsData ?? []) as Complaint[]);

      // 3) Casos do seller
      const { data: casesData, error: casesError } = await supabase
        .from("cases")
        .select("id,status,protocol_number,complaint_id,created_at")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });

      if (casesError) {
        setMsg(casesError.message);
        setCases([]);
        setLoading(false);
        return;
      }

      setCases((casesData ?? []) as CaseRow[]);
      setLoading(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Erro ao carregar dados");
      setLoading(false);
    }
  }

  async function createCaseFromComplaint(complaintId: string) {
    setMsg(null);

    if (caseByComplaintId.has(complaintId)) {
      setMsg("Não é permitido criar 2 casos para a mesma reclamação.");
      return;
    }

    const { data: existing, error: existingError } = await supabase
      .from("cases")
      .select("id")
      .eq("complaint_id", complaintId)
      .maybeSingle();

    if (existingError) {
      setMsg(existingError.message);
      return;
    }

    if (existing) {
      setMsg("Não é permitido criar 2 casos para a mesma reclamação.");
      await loadAll();
      return;
    }

    const { error } = await supabase.from("cases").insert({
      seller_id: sellerId,
      complaint_id: complaintId,
      status: "novo",
    });

    if (error) {
      if ((error as any).code === "23505") {
        setMsg("Não é permitido criar 2 casos para a mesma reclamação.");
        await loadAll();
        return;
      }
      setMsg(error.message);
      return;
    }

    await loadAll();
  }

  async function updateCaseStatus(caseId: string, newStatus: CaseRow["status"]) {
    setMsg(null);

    const { error } = await supabase.from("cases").update({ status: newStatus }).eq("id", caseId);

    if (error) {
      setMsg(error.message);
      return;
    }

    await loadAll();
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId]);

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <p>Carregando...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Seller</h1>
        <p>Você não está logado.</p>
        <Link href="/login">Ir para login</Link>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div style={{ padding: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Acesso negado</h1>
        <p style={{ marginTop: 8 }}>Você não tem permissão para acessar este seller, ou ele não existe.</p>
        <div style={{ marginTop: 12 }}>
          <Link href="/dashboard/sellers">Voltar</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <MlConnectCard sellerId={sellerId} />

      <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 16 }}>
        Seller Details{sellerAccount?.nickname ? ` — ${sellerAccount.nickname}` : ""}
      </h1>

      <p>
        Seller ID: <code>{sellerId}</code>
      </p>

      {msg && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            border: "1px solid #ff4bd1",
            borderRadius: 8,
          }}
        >
          {msg}
        </div>
      )}

      <hr style={{ margin: "20px 0" }} />

      <h2>Reclamações</h2>
      {!loading && complaints.length === 0 && <p>Nenhuma reclamação encontrada.</p>}

      <ul style={{ paddingLeft: 16 }}>
        {complaints.map((c) => {
          const existingCase = caseByComplaintId.get(c.id);

          return (
            <li key={c.id} style={{ marginBottom: 14 }}>
              <div>
                <b>{c.reason ?? "Sem motivo"}</b> — {c.status ?? "-"}
              </div>
              <div>Caso ML: {c.ml_case_id}</div>
              <div>Impacto: {c.impact_level ?? "-"}</div>
              <div>Defensável: {c.is_defensible ? "SIM" : "NÃO"}</div>

              {existingCase ? (
                <div style={{ marginTop: 8 }}>
                  <b>Já existe caso:</b> #{existingCase.id.slice(0, 6)} (status: {existingCase.status})
                </div>
              ) : (
                <button
                  style={{
                    marginTop: 8,
                    padding: 8,
                    borderRadius: 8,
                    cursor: "pointer",
                  }}
                  onClick={() => createCaseFromComplaint(c.id)}
                >
                  Criar caso
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <hr style={{ margin: "20px 0" }} />

      <h2>Casos (Tratativas)</h2>
      {!loading && cases.length === 0 && <p>Nenhum caso criado ainda.</p>}

      <ul style={{ paddingLeft: 16 }}>
        {cases.map((cs) => (
          <li key={cs.id} style={{ marginBottom: 14 }}>
            <div>
              <b>Caso #{cs.id.slice(0, 6)}</b> — Status: <b>{cs.status}</b>
            </div>
            <div>Protocolo: {cs.protocol_number ?? "-"}</div>
            <div>Complaint ID: {cs.complaint_id ?? "-"}</div>

            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button onClick={() => updateCaseStatus(cs.id, "novo")} style={{ padding: 8, borderRadius: 8 }}>
                Novo
              </button>
              <button onClick={() => updateCaseStatus(cs.id, "em_analise")} style={{ padding: 8, borderRadius: 8 }}>
                Em análise
              </button>
              <button onClick={() => updateCaseStatus(cs.id, "chamado_aberto")} style={{ padding: 8, borderRadius: 8 }}>
                Chamado aberto
              </button>
              <button onClick={() => updateCaseStatus(cs.id, "resolvido")} style={{ padding: 8, borderRadius: 8 }}>
                Resolvido
              </button>
              <button onClick={() => updateCaseStatus(cs.id, "negado")} style={{ padding: 8, borderRadius: 8 }}>
                Negado
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
