import { useEffect, useState } from "react";
import { useAppStore } from "../../stores/app-store";
import {
  getRoomStudio,
  saveRoomStudioAgent,
  saveRoomStudioProvider,
  saveRoomStudioRules,
  testRoomStudioProvider,
  type StudioProvider,
  type RoomStudioSnapshot,
} from "../../lib/room-studio";

type Feedback = { kind: "ok" | "error"; text: string } | null;

const AVATARS = ["♠", "♥", "♦", "♣", "🃏", "A♠", "K♣", "Q♥", "J♦"];

export function RoomStudioPanel() {
  const state = useAppStore((s) => s.state);
  const account = useAppStore((s) => s.account);
  const accountToken = useAppStore((s) => s.accountToken);
  const roomId = state?.roomId;

  const [loaded, setLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<RoomStudioSnapshot | null>(null);
  const [error, setError] = useState<Feedback>(null);

  const [provider, setProvider] = useState<StudioProvider | null>(null);
  const [providerName, setProviderName] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [providerMsg, setProviderMsg] = useState<Feedback>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<Feedback>(null);

  const [agentName, setAgentName] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("♠");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentMsg, setAgentMsg] = useState<Feedback>(null);

  const [rulesText, setRulesText] = useState("");
  const [rulesMsg, setRulesMsg] = useState<Feedback>(null);

  useEffect(() => {
    if (!accountToken || !roomId) return;
    setLoaded(false);
    getRoomStudio(accountToken, roomId)
      .then((snapshotResult) => {
        setSnapshot(snapshotResult);
        if (snapshotResult.provider) {
          setProvider(snapshotResult.provider);
          setProviderName(snapshotResult.provider.name);
          setProviderBaseUrl(snapshotResult.provider.baseUrl);
          setProviderModel(snapshotResult.provider.model);
        }
        if (snapshotResult.agent) {
          setAgentName(snapshotResult.agent.name);
          setAgentAvatar(snapshotResult.agent.avatar);
          setAgentPrompt(snapshotResult.agent.systemPrompt);
        }
        setRulesText(snapshotResult.rules.join("\n"));
        setError(null);
      })
      .catch(() => setError({ kind: "error", text: "Não foi possível carregar o studio da sala. Verifique se você é o dono da mesa." }))
      .finally(() => setLoaded(true));
  }, [accountToken, roomId]);

  if (!account || !accountToken || !roomId) {
    return (
      <section className="studio-panel">
        <h4>Studio de IA da sala</h4>
        <p className="config-notice">
          Entre na sua conta para configurar a IA desta mesa. Sem conta, a mesa usa a IA padrão do sistema.
        </p>
      </section>
    );
  }

  const providerHasSavedKey = Boolean(provider?.hasApiKey);
  const providerCanSave =
    Boolean(providerName.trim()) &&
    Boolean(providerBaseUrl.trim()) &&
    Boolean(providerModel.trim()) &&
    (providerHasSavedKey || Boolean(providerApiKey.trim()));

  const saveProvider = async () => {
    setProviderMsg(null);
    if (!providerCanSave) {
      setProviderMsg({ kind: "error", text: "Informe nome, host, modelo e token para salvar o provedor da mesa." });
      return;
    }
    try {
      const saved = await saveRoomStudioProvider(accountToken, roomId, {
        name: providerName.trim(),
        baseUrl: providerBaseUrl.trim(),
        model: providerModel.trim(),
        ...(providerApiKey.trim() ? { apiKey: providerApiKey.trim() } : {}),
      });
      setProvider(saved);
      setProviderMsg({ kind: "ok", text: "Provedor da mesa salvo." });
    } catch {
      setProviderMsg({ kind: "error", text: "Não foi possível salvar. Confira os campos." });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    if (!providerHasSavedKey && !providerApiKey.trim()) {
      setTestMsg({ kind: "error", text: "Informe o token para testar este provedor." });
      setTesting(false);
      return;
    }
    try {
      const result = await testRoomStudioProvider(accountToken, roomId, {
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
      await saveRoomStudioAgent(accountToken, roomId, {
        name: agentName.trim(),
        avatar: agentAvatar.trim() || "♠",
        systemPrompt: agentPrompt,
      });
      setAgentMsg({ kind: "ok", text: "Agente da mesa salvo." });
    } catch {
      setAgentMsg({ kind: "error", text: "Não foi possível salvar o agente." });
    }
  };

  const saveRules = async () => {
    setRulesMsg(null);
    try {
      await saveRoomStudioRules(accountToken, roomId, rulesText.split("\n"));
      setRulesMsg({ kind: "ok", text: "Regras da mesa salvas." });
    } catch {
      setRulesMsg({ kind: "error", text: "Não foi possível salvar as regras." });
    }
  };

  return (
    <section className="studio-panel">
      <h4>Studio de IA da sala</h4>
      <p>A IA desta mesa usa esta configuração antes da sua conta e dos padrões do sistema. Deixe campos ausentes para herdar da sua conta.</p>
      {!loaded && <p>Carregando o studio da mesa...</p>}
      {error && <p className="account-error" role="alert">{error.text}</p>}
      {snapshot === null && loaded && <p className="studio-hint">Nenhuma configuração própria ainda — a mesa segue o Studio da sua conta.</p>}

      <label>
        Nome do provedor da mesa
        <input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="OpenRouter" />
      </label>
      <label>
        Host (URL da API)
        <input value={providerBaseUrl} onChange={(e) => setProviderBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" />
      </label>
      <label>
        Token da mesa
        <input type="password" value={providerApiKey} onChange={(e) => setProviderApiKey(e.target.value)} placeholder={providerHasSavedKey ? "Deixe vazio para manter o atual" : "Obrigatório no primeiro cadastro"} />
      </label>
      <label>
        Modelo
        <input value={providerModel} onChange={(e) => setProviderModel(e.target.value)} placeholder="openai/gpt-4o-mini" />
      </label>
      {provider && (
        <p className="studio-hint">Token salvo: <span className="studio-masked">{provider.apiKeyMasked}</span></p>
      )}
      <div className="studio-actions">
        <button className="secondary" type="button" onClick={() => void saveProvider()} disabled={!providerCanSave}>Salvar provedor</button>
        <button className="secondary" type="button" onClick={() => void handleTest()} disabled={testing}>
          {testing ? "Testando..." : "Testar conexão"}
        </button>
      </div>
      {providerMsg && <p className={providerMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{providerMsg.text}</p>}
      {testMsg && <p className={testMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{testMsg.text}</p>}

      <label>
        Nome do agente da mesa
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
        Prompt de persona da mesa
        <textarea
          value={agentPrompt}
          onChange={(e) => setAgentPrompt(e.target.value)}
          maxLength={4000}
          placeholder="Você é um contribuidor sênior desta mesa..."
        />
      </label>
      <button className="secondary" type="button" onClick={() => void saveAgent()} disabled={!agentName.trim()}>Salvar agente</button>
      {agentMsg && <p className={agentMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{agentMsg.text}</p>}

      <label>
        Regras de negócio da mesa (uma por linha)
        <textarea
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          placeholder={"Moeda do projeto: BRL\nEstimativas em dias-pessoa\nNão estimar tarefa acima de 13 sem dividir"}
        />
      </label>
      <button className="secondary" type="button" onClick={() => void saveRules()}>Salvar regras</button>
      {rulesMsg && <p className={rulesMsg.kind === "ok" ? "account-ok" : "account-error"} role="status">{rulesMsg.text}</p>}
    </section>
  );
}
