import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Session, Subscription } from "@supabase/supabase-js";
import { API, getClient, RadarAuthError, type RadarSummary } from "../src/api";
import { clearWidget, publishWidget } from "../src/sync";
import { fetchRadar } from "../src/api";
import { registerBackground, stopBackground } from "../src/background";

export default function RadarScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<RadarSummary | null>(null);
  const generation = useRef(0);
  const syncing = useRef(false);

  const refresh = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    const version = generation.current;
    setBusy(true); setError("");
    try {
      const data = await fetchRadar();
      if (version !== generation.current) return;
      setSummary(data);
      await publishWidget(data);
      await registerBackground();
    } catch (failure) {
      if (failure instanceof RadarAuthError) { setSummary(null); await clearWidget(); }
      setError(failure instanceof Error ? failure.message : "Não foi possível atualizar.");
    }
    finally { syncing.current = false; setBusy(false); }
  }, []);

  useEffect(() => {
    let disposed = false;
    let subscription: Subscription | undefined;
    getClient().then(async (client) => {
      if (disposed) return;
      subscription = client.auth.onAuthStateChange((_event, next) => {
        generation.current++;
        setSession(next);
        if (!next) { setSummary(null); void clearWidget(); }
      }).data.subscription;
      const { data } = await client.auth.getSession();
      if (!disposed) setSession(data.session);
    }).catch((failure) => setError(failure.message)).finally(() => setInitializing(false));
    return () => { disposed = true; subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) return;
    void refresh();
    const listener = AppState.addEventListener("change", (state) => {
      void getClient().then((client) => {
        if (state === "active") { client.auth.startAutoRefresh(); void refresh(); }
        else client.auth.stopAutoRefresh();
      });
    });
    const timer = setInterval(() => { if (AppState.currentState === "active") void refresh(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [session?.user.id, refresh]);

  async function login() {
    setBusy(true); setError("");
    try {
      const client = await getClient();
      const { data, error: failure } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (failure) throw failure;
      setSession(data.session); setPassword("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }

  async function logout() {
    generation.current++;
    setSummary(null); setSession(null);
    try {
      await Promise.allSettled([clearWidget(), stopBackground()]);
      const { error: failure } = await (await getClient()).auth.signOut({ scope: "local" });
      if (failure) throw failure;
    }
    catch { setError("Não foi possível encerrar a sessão. Tente novamente."); }
  }

  const open = (path: string) => { void Linking.openURL(`${API}${path}`).catch(() => setError("Não foi possível abrir o CRM.")); };
  return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={session ? <RefreshControl refreshing={busy} onRefresh={refresh} tintColor="#3bdfa1" /> : undefined}>
    <Text style={styles.eyebrow}>SUBA PRO VERDE</Text>
    <Text style={styles.title}>Seu dia, no radar.</Text>
    <Text style={styles.subtitle}>Agenda e prioridades da sua operação, sempre à mão.</Text>
    {initializing && <ActivityIndicator color="#3bdfa1" />}
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {!initializing && !session && <View style={styles.card}>
      <Text style={styles.heading}>Entre com sua conta do CRM</Text>
      <TextInput accessibilityLabel="E-mail" style={styles.input} placeholder="Seu e-mail" placeholderTextColor="#a0b6ad" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextInput accessibilityLabel="Senha" style={styles.input} placeholder="Sua senha" placeholderTextColor="#a0b6ad" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
      <Pressable accessibilityRole="button" disabled={busy || !email || !password} style={styles.button} onPress={login}><Text style={styles.buttonText}>{busy ? "Entrando…" : "Entrar"}</Text></Pressable>
    </View>}
    {session && <>
      <View style={styles.metrics}>
        {[ ["Hoje", summary?.metrics.today], ["Atrasados", summary?.metrics.overdue], ["Precisam de você", summary?.metrics.waitingTeam], ["Leads ativos", summary?.metrics.activeLeads] ].map(([label, value]) => <View key={label} style={styles.metric}><Text style={styles.metricNumber}>{value ?? "—"}</Text><Text style={styles.secondary}>{label}</Text></View>)}
      </View>
      <Text style={styles.heading}>Agenda e próximos passos</Text>
      {summary?.tasks.length === 0 && <Text style={styles.secondary}>Nenhum compromisso pendente nos próximos 7 dias.</Text>}
      {summary?.tasks.map((task) => <Pressable accessibilityRole="button" key={task.id} style={[styles.card, task.overdue && styles.overdue]} onPress={() => open(`/admin/crm/agenda?taskId=${encodeURIComponent(task.id)}&date=${encodeURIComponent(task.dueAt)}`)}>
        <Text style={styles.time}>{new Date(task.dueAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}{task.overdue ? " · Atrasado" : ""}</Text>
        <Text style={styles.heading}>{task.title}</Text><Text style={styles.secondary}>{task.contactName}  ↗</Text>
      </Pressable>)}
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => open("/admin/crm/agenda")}><Text style={styles.buttonText}>Abrir agenda completa</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={() => open("/admin/crm/conversas")}><Text style={styles.heading}>Conversas do WhatsApp ↗</Text></Pressable>
      <Pressable accessibilityRole="button" style={styles.outlineButton} disabled={busy} onPress={refresh}><Text style={styles.heading}>{busy ? "Atualizando…" : "Atualizar widget"}</Text></Pressable>
      <View style={styles.card}><Text style={styles.heading}>Coloque o Radar na tela inicial</Text><Text style={styles.secondary}>No iPhone, mantenha o dedo na tela inicial, toque em Editar → Adicionar Widget e procure Radar SPV. Escolha o tamanho que preferir.</Text><Text style={styles.secondary}>Os dados atualizam ao abrir o app. O widget mostra quando foi atualizado; novos dados em segundo plano dependem da disponibilidade do iOS.</Text></View>
      <Text style={styles.secondary}>{summary ? `Atualizado ${new Date(summary.generatedAt).toLocaleString("pt-BR")}` : "Aguardando sincronização"}</Text>
      <Pressable accessibilityRole="button" style={styles.outlineButton} onPress={logout}><Text style={styles.secondary}>Sair e limpar o widget</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#07140f" }, content: { padding: 22, gap: 16, maxWidth: 680, width: "100%", alignSelf: "center", paddingBottom: 36 },
  eyebrow: { color: "#3bdfa1", fontSize: 12, letterSpacing: 2, fontWeight: "700" }, title: { color: "#f3faf5", fontSize: 34, fontWeight: "800" }, subtitle: { color: "#acbfb4", fontSize: 16, lineHeight: 23 },
  card: { padding: 18, borderRadius: 20, backgroundColor: "#11281e", borderWidth: 1, borderColor: "#244234", gap: 10 }, heading: { color: "#f3faf5", fontSize: 16, fontWeight: "600" }, secondary: { color: "#b0c7b9", fontSize: 13, lineHeight: 21 },
  input: { padding: 15, borderWidth: 1, borderColor: "#365d48", borderRadius: 12, color: "#fff", fontSize: 16 }, button: { padding: 17, backgroundColor: "#3bdfa1", borderRadius: 14, alignItems: "center" }, buttonText: { color: "#092016", fontSize: 16, fontWeight: "700" }, outlineButton: { padding: 16, alignItems: "center", borderWidth: 1, borderColor: "#365d48", borderRadius: 14 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, metric: { flexGrow: 1, width: "45%", padding: 18, backgroundColor: "#11281e", borderRadius: 18 }, metricNumber: { color: "#3bdfa1", fontSize: 30, fontWeight: "700" }, time: { color: "#76e3b4", fontSize: 13, fontWeight: "600" }, overdue: { borderColor: "#a55a39" }, error: { color: "#ffc0ae", padding: 12, backgroundColor: "#462719", borderRadius: 12 },
});
