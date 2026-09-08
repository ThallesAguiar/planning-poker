import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStudio, saveStudioAgent, saveStudioProvider, saveStudioRules, testStudioProvider, type StudioProvider } from "../../lib/studio";
import { useAppStore } from "../../stores/app-store";
import { DashboardShell } from "./DashboardPages";

type Feedback = { kind: "ok" | "error"; text: string } | null;

const AVATARS = ["♠", "♥", "♦", "♣", "🃏", "🎩", "🤖", "🐙", "🚀"];

export function StudioPage() {
  const { account, accountToken } = useAppStore();
  const [loading, setLoading] = useState(false);

  const [provider, setProvider] = useState<StudioProvider | null>(null);
  const [providerName, setProviderName] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [providerMsg, setProviderMsg] = useState<Feedback>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<Feedback>(null);

  const [agentName, setAgentName] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("🤖");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentMsg, setAgentMsg] = useState<Feedback>(null);

  const [rulesText, setRulesText] = useState("");
  const [rulesMsg, setRulesMsg] = useState<Feedback>(null);
  const providerHasSavedKey = Boolean(provider?.hasApiKey);
  const providerCanSave =
    Boolean(providerName.trim()) &&
    Boolean(providerBaseUrl.trim()) &&
    Boolean(providerModel.trim()) &&
    (providerHasSavedKey || Boolean(providerApiKey.trim()));

  useEffect(() => {
    if (!accountToken) return;
    setLoading(true);
    getStudio(accountToken)
      .then((snapshot) => {
        if (snapshot.provider) {
          setProvider(snapshot.provider);
          setProviderName(snapshot.provider.name);
          setProviderBaseUrl(snapshot.provider.baseUrl);
          setProviderModel(snapshot.provider.model);
        }
        if (snapshot.agent) {
          setAgentName(snapshot.agent.name);
          setAgentAvatar(snapshot.agent.avatar);
          setAgentPrompt(snapshot.agent.systemPrompt);
        }
        setRulesText(snapshot.rules.join("\n"));
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [accountToken]);

  if (!account || !accountToken) {
    return (
      <DashboardShell>
        <div className="dashboard-title"><div><h1>Studio</h1><p>Entre com sua conta para configurar as IA das suas mesas.</p></div></div>
        <Link className="primary" to="/">Ir para home</Link>
      </DashboardShell>
    );
  }

  const saveProvider = async () => {
    setProviderMsg(null);
    if (!providerCanSave) {
      setProviderMsg({ kind: "error", text: "Informe nome, host, modelo e token da sua conta para salvar o provedor." });
      return;
    }
    try {
      const saved = await saveStudioProvider(accountToken, {
        name: providerName.trim(),
        baseUrl: providerBaseUrl.trim(),
        model: providerModel.trim(),
        ...(providerApiKey.trim() ? { apiKey: providerApiKey.trim() } : {}),
      });
      setProvider(saved);
      setProviderMsg({ kind: "ok", text: "Provedor salvo." });
    } catch {
      setProviderMsg({ kind: "error", text: "Não foi possível salvar. Confira os campos." });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    if (!providerHasSavedKey && !providerApiKey.trim()) {
      setTestMsg({ kind: "error", text: "Informe o token da sua conta para testar este provedor." });
      setTesting(false);
      return;
    }
    try {
      const result = await testStudioProvider(accountToken, {
        baseUrl: providerBaseUrl.trim() || undefined,
        apiKey: providerApiKey.trim() || undefined,
        model: providerModel.trim() || undefined,
      });
      setTestMsg({ kind: "ok", text: `Conectou em ${result.latencyMs}ms.` });
    } catch {
      setTestMsg({ kind: "error", text: "Não conectou. Confira host, modelo e token." });
    } finally {
      setTesting(false);
    }
  };

  const saveAgent = async () => {
    setAgentMsg(null);
    try {
      await saveStudioAgent(accountToken, {
        name: agentName.trim(),
        avatar: agentAvatar.trim() || "🤖",
        systemPrompt: agentPrompt,
      });
      setAgentMsg({ kind: "ok", text: "Agente salvo." });
    } catch {
      setAgentMsg({ kind: "error", text: "Não foi possível salvar o agente." });
    }
  };

  const saveRules = async () => {
    setRulesMsg(null);
    try {
      await saveStudioRules(accountToken, rulesText.split("\n"));
      setRulesMsg({ kind: "ok", text: "Regras salvas." });
    } catch {
      setRulesMsg({ kind: "error", text: "Não foi possível salvar as regras." });
    }
  };

  return (
    <DashboardShell>
      <div className="dashboard-title">
        <div>
          <h1>Studio</h1>
          <p>Configure a identidade, o contexto e as credenciais das IA que participam das mesas que você dirige.</p>
        </div>
      </div>

      {loading && <p>Carregando seu studio...</p>}

      <div className="studio-grid">
        <section className="studio-panel">
          <h2>Provedor LLM</h2>
          <p>
            {provider ? (
              <>Credenciais da sua conta<span className="studio-badge ok">salvo na conta</span></>
            ) : (
              <>Nenhum provedor cadastrado <span className="studio-badge muted">configuração própria</span></>
            )}
          </p>
          {provider ? (
            <p className="studio-hint">Token salvo: <span className="studio-masked">{provider.apiKeyMasked}</span></p>
          ) : (
            <p className="studio-hint">Informe host, modelo e token da sua conta. O provedor fica salvo no seu login, não em variáveis de ambiente.</p>
          )}
          <label>
            Nome do provedor
            <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="OpenRouter" />
          </label>
          <label>
            Host (URL da API)
            <input value={providerBaseUrl} onChange={(e) => setProviderBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" />
          </label>
          <label>
            Token da sua conta
            <input type="password" value={providerApiKey} onChange={(e) => setProviderApiKey(e.target.value)} placeholder={providerHasSavedKey ? "Deixe vazio para manter o atual" : "Obrigatório no primeiro cadastro"} />
          </label>
          <label>
            Modelo
            <input value={providerModel} onChange={(e) => setProviderModel(e.target.value)} placeholder="openai/gpt-4o-mini" />
          </label>
          <div className="studio-actions">
            <button className="primary" type="button" onClick={() => void saveProvider()} disabled={!providerCanSave}>Salvar provedor</button>
            <button className="secondary" type="button" onClick={() => void handleTest()} disabled={testing}>
              {testing ? "Testando..." : "Testar conexão"}
            </button>
          </div>
          {providerMsg && <p className={providerMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{providerMsg.text}</p>}
          {testMsg && <p className={testMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{testMsg.text}</p>}
        </section>

        <section className="studio-panel">
          <h2>Agente (persona)</h2>
          <p>Nome e avatar do bot que aparece na mesa quando você permite participantes IA.</p>
          <label>
            Nome
            <input value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={60} />
          </label>
          <label>
            Avatar
            <div className="avatar-pick">
              <div>
                {AVATARS.map((item) => (
                  <button type="button" className={agentAvatar === item ? "active" : ""} onClick={() => setAgentAvatar(item)} key={item}>
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </label>
          <label>
            Prompt de persona
            <textarea
              value={agentPrompt}
              onChange={(e) => setAgentPrompt(e.target.value)}
              maxLength={4000}
              placeholder="Você é um contribuidor sênior de planning poker..."
            />
          </label>
          <button className="primary" type="button" onClick={() => void saveAgent()} disabled={!agentName.trim()}>Salvar agente</button>
          {agentMsg && <p className={agentMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{agentMsg.text}</p>}
        </section>

        <section className="studio-panel">
          <h2>Regras de negócio</h2>
          <p>Uma regra por linha. Entram no contexto da IA em todas as mesas que você dirige.</p>
          <label>
            Regras
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder={"Moeda do projeto: BRL\nEstimativas em dias-pessoa\nNão estimar tarefa acima de 13 sem dividir"}
            />
          </label>
          <button className="primary" type="button" onClick={() => void saveRules()}>Salvar regras</button>
          {rulesMsg && <p className={rulesMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{rulesMsg.text}</p>}
        </section>
      </div>
    </DashboardShell>
  );
}
