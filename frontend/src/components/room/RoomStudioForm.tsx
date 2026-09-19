import { useEffect, useState } from "react";
import {
  getRoomStudio,
  inheritRoomStudioAgent,
  inheritRoomStudioProvider,
  inheritRoomStudioRules,
  saveRoomStudioAgent,
  saveRoomStudioProvider,
  saveRoomStudioRules,
  testRoomStudioProvider,
  type RoomStudioSnapshot,
  type StudioProvider,
} from "../../api/room-studio";
import { studioAvatars } from '../../data/avatars';

type Feedback = { kind: "ok" | "error"; text: string } | null;
type StudioMode = "account" | "room";

function ModeSwitch({ mode, accountLabel, roomLabel, onChange }: {
  mode: StudioMode;
  accountLabel: string;
  roomLabel: string;
  onChange: (mode: StudioMode) => void;
}) {
  return (
    <div className="studio-mode-switch" role="group">
      <button type="button" className={mode === "account" ? "is-active" : ""} onClick={() => onChange("account")}>
        {accountLabel}
      </button>
      <button type="button" className={mode === "room" ? "is-active" : ""} onClick={() => onChange("room")}>
        {roomLabel}
      </button>
    </div>
  );
}

function ProviderPreview({ provider }: { provider: StudioProvider | null }) {
  if (!provider) return <p className="studio-hint">Nenhum provedor salvo na sua conta.</p>;
  return (
    <div className="studio-preview">
      <b>{provider.name}</b>
      <span>{provider.model}</span>
      <small>{provider.baseUrl}</small>
      <small>Token: <span className="studio-masked">{provider.apiKeyMasked}</span></small>
    </div>
  );
}

function feedbackClass(feedback: Feedback) {
  return feedback?.kind === "ok" ? "account-ok" : "account-error";
}

export interface RoomStudioFormProps {
  roomId: string;
  accountToken: string;
}

export function RoomStudioForm({ roomId, accountToken }: RoomStudioFormProps) {
  const [loaded, setLoaded] = useState(false);
  const [snapshot, setSnapshot] = useState<RoomStudioSnapshot | null>(null);
  const [error, setError] = useState<Feedback>(null);

  const [provider, setProvider] = useState<StudioProvider | null>(null);
  const [providerMode, setProviderMode] = useState<StudioMode>("account");
  const [providerName, setProviderName] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerModel, setProviderModel] = useState("");
  const [providerMsg, setProviderMsg] = useState<Feedback>(null);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<Feedback>(null);

  const [agentMode, setAgentMode] = useState<StudioMode>("account");
  const [agentName, setAgentName] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("♠");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [agentMsg, setAgentMsg] = useState<Feedback>(null);

  const [rulesMode, setRulesMode] = useState<StudioMode>("account");
  const [rulesText, setRulesText] = useState("");
  const [rulesMsg, setRulesMsg] = useState<Feedback>(null);

  const loadStudio = async () => {
    setLoaded(false);
    try {
      const snapshotResult = await getRoomStudio(accountToken, roomId);
      setSnapshot(snapshotResult);
      setProvider(snapshotResult.provider);
      setProviderMode(snapshotResult.provider ? "room" : "account");
      setProviderName(snapshotResult.provider?.name ?? "");
      setProviderBaseUrl(snapshotResult.provider?.baseUrl ?? "");
      setProviderModel(snapshotResult.provider?.model ?? "");
      setProviderApiKey("");
      setAgentMode(snapshotResult.agent ? "room" : "account");
      setAgentName(snapshotResult.agent?.name ?? "");
      setAgentAvatar(snapshotResult.agent?.avatar ?? "♠");
      setAgentPrompt(snapshotResult.agent?.systemPrompt ?? "");
      setRulesMode(snapshotResult.rules.length > 0 ? "room" : "account");
      setRulesText(snapshotResult.rules.join("\n"));
      setError(null);
    } catch {
      setError({ kind: "error", text: "Não foi possível carregar o Studio da sala. Verifique se você é o dono da mesa." });
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void loadStudio();
  }, [accountToken, roomId]);

  const accountProvider = snapshot?.account?.provider ?? null;
  const accountAgent = snapshot?.account?.agent ?? null;
  const accountRules = snapshot?.account?.rules ?? [];
  const providerHasSavedKey = Boolean(provider?.hasApiKey);
  const providerCanSave =
    Boolean(providerName.trim()) &&
    Boolean(providerBaseUrl.trim()) &&
    Boolean(providerModel.trim()) &&
    (providerHasSavedKey || Boolean(providerApiKey.trim()));

  const chooseProviderMode = async (mode: StudioMode) => {
    setProviderMode(mode);
    setProviderMsg(null);
    setTestMsg(null);
    if (mode !== "account") return;
    await inheritRoomStudioProvider(accountToken, roomId);
    await loadStudio();
    setProviderMsg({ kind: "ok", text: "Provedor da mesa agora herda sua conta." });
  };

  const chooseAgentMode = async (mode: StudioMode) => {
    setAgentMode(mode);
    setAgentMsg(null);
    if (mode !== "account") return;
    await inheritRoomStudioAgent(accountToken, roomId);
    await loadStudio();
    setAgentMsg({ kind: "ok", text: "Agente da mesa agora herda sua conta." });
  };

  const chooseRulesMode = async (mode: StudioMode) => {
    setRulesMode(mode);
    setRulesMsg(null);
    if (mode !== "account") return;
    await inheritRoomStudioRules(accountToken, roomId);
    await loadStudio();
    setRulesMsg({ kind: "ok", text: "Regras da mesa agora herdam sua conta." });
  };

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
      await loadStudio();
      setProviderMode("room");
      setProviderMsg({ kind: "ok", text: "Provedor próprio da mesa salvo." });
    } catch {
      setProviderMsg({ kind: "error", text: "Não foi possível salvar. Confira os campos." });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    if (providerMode === "room" && !providerHasSavedKey && !providerApiKey.trim()) {
      setTestMsg({ kind: "error", text: "Informe o token para testar este provedor." });
      setTesting(false);
      return;
    }
    try {
      const result = await testRoomStudioProvider(accountToken, roomId, providerMode === "room" ? {
        baseUrl: providerBaseUrl.trim() || undefined,
        apiKey: providerApiKey.trim() || undefined,
        model: providerModel.trim() || undefined,
      } : {});
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
      await loadStudio();
      setAgentMode("room");
      setAgentMsg({ kind: "ok", text: "Agente próprio da mesa salvo." });
    } catch {
      setAgentMsg({ kind: "error", text: "Não foi possível salvar o agente." });
    }
  };

  const saveRules = async () => {
    setRulesMsg(null);
    try {
      await saveRoomStudioRules(accountToken, roomId, rulesText.split("\n"));
      await loadStudio();
      setRulesMode("room");
      setRulesMsg({ kind: "ok", text: "Regras próprias da mesa salvas." });
    } catch {
      setRulesMsg({ kind: "error", text: "Não foi possível salvar as regras." });
    }
  };

  if (!loaded) return <p>Carregando o Studio da mesa...</p>;

  if (error) return <p className="account-error" role="alert">{error.text}</p>;

  return (
    <>
      <p className="studio-note">Use a conta para seguir seu agente/provedor padrão. Use "Configurar nesta mesa" para criar uma IA própria desta mesa. Ao voltar para herdar da conta, a configuração própria da mesa é removida.</p>
      <div className="studio-grid">
        <section className="studio-panel">
          <h2>Provedor</h2>
          <p className="studio-hint">Herdado usa o provedor salvo no seu Studio. Próprio usa host, modelo e token exclusivos desta mesa.</p>
          <ModeSwitch mode={providerMode} accountLabel="Usar provedor da minha conta" roomLabel="Configurar nesta mesa" onChange={(mode) => void chooseProviderMode(mode)} />
          {providerMode === "account" ? (
            <>
              <ProviderPreview provider={accountProvider} />
              <button className="secondary" type="button" onClick={() => void handleTest()} disabled={testing || !accountProvider}>
                {testing ? "Testando..." : "Testar conexão herdada"}
              </button>
            </>
          ) : (
            <>
              <label>Nome do provedor da mesa<input value={providerName} onChange={(e) => setProviderName(e.target.value)} placeholder="OpenRouter" /></label>
              <label>Host (URL da API)<input value={providerBaseUrl} onChange={(e) => setProviderBaseUrl(e.target.value)} placeholder="https://openrouter.ai/api/v1" /></label>
              <label>Token da mesa<input type="password" value={providerApiKey} onChange={(e) => setProviderApiKey(e.target.value)} placeholder={providerHasSavedKey ? "Deixe vazio para manter o atual" : "Obrigatório no primeiro cadastro"} /></label>
              <label>Modelo<input value={providerModel} onChange={(e) => setProviderModel(e.target.value)} placeholder="openai/gpt-4o-mini" /></label>
              {provider && <p className="studio-hint">Token salvo: <span className="studio-masked">{provider.apiKeyMasked}</span></p>}
              <div className="studio-actions">
                <button className="secondary" type="button" onClick={() => void saveProvider()} disabled={!providerCanSave}>Salvar provedor</button>
                <button className="secondary" type="button" onClick={() => void handleTest()} disabled={testing}>{testing ? "Testando..." : "Testar conexão"}</button>
              </div>
            </>
          )}
          {providerMsg && <p className={feedbackClass(providerMsg)} role="status">{providerMsg.text}</p>}
          {testMsg && <p className={feedbackClass(testMsg)} role="status">{testMsg.text}</p>}
        </section>

        <section className="studio-panel">
          <h2>Agente (persona)</h2>
          <p className="studio-hint">Herdado usa o agente salvo no seu Studio. Próprio cria outro agente só para esta mesa.</p>
          <ModeSwitch mode={agentMode} accountLabel={`Usar ${accountAgent?.name ?? "agente da minha conta"}`} roomLabel="Configurar nesta mesa" onChange={(mode) => void chooseAgentMode(mode)} />
          {agentMode === "account" ? (
            accountAgent ? (
              <div className="studio-preview"><b>{accountAgent.avatar} {accountAgent.name}</b><small>{accountAgent.systemPrompt || "Sem prompt de persona."}</small></div>
            ) : (
              <p className="studio-hint">Nenhum agente salvo na sua conta.</p>
            )
          ) : (
            <>
              <label>Nome do agente da mesa<input value={agentName} onChange={(e) => setAgentName(e.target.value)} maxLength={60} /></label>
              <label>Avatar<div className="avatar-pick"><div>{studioAvatars.map((item) => <button type="button" className={agentAvatar === item ? "active" : ""} onClick={() => setAgentAvatar(item)} key={item}>{item}</button>)}</div></div></label>
              <label>Prompt de persona da mesa<textarea value={agentPrompt} onChange={(e) => setAgentPrompt(e.target.value)} maxLength={4000} placeholder="Você é um contribuidor sênior desta mesa..." /></label>
              <button className="secondary" type="button" onClick={() => void saveAgent()} disabled={!agentName.trim()}>Salvar agente</button>
            </>
          )}
          {agentMsg && <p className={feedbackClass(agentMsg)} role="status">{agentMsg.text}</p>}
        </section>

        <section className="studio-panel">
          <h2>Regras de negócio</h2>
          <p className="studio-hint">Herdadas seguem as regras da sua conta. Próprias substituem as regras da conta somente nesta mesa.</p>
          <ModeSwitch mode={rulesMode} accountLabel="Usar regras da minha conta" roomLabel="Configurar nesta mesa" onChange={(mode) => void chooseRulesMode(mode)} />
          {rulesMode === "account" ? (
            accountRules.length > 0 ? <div className="studio-preview">{accountRules.map((rule) => <small key={rule}>{rule}</small>)}</div> : <p className="studio-hint">Nenhuma regra salva na sua conta.</p>
          ) : (
            <>
              <label>Regras de negócio da mesa (uma por linha)<textarea value={rulesText} onChange={(e) => setRulesText(e.target.value)} placeholder={"Moeda do projeto: BRL\nEstimativas em dias-pessoa\nNão estimar tarefa acima de 13 sem dividir"} /></label>
              <button className="secondary" type="button" onClick={() => void saveRules()}>Salvar regras</button>
            </>
          )}
          {rulesMsg && <p className={feedbackClass(rulesMsg)} role="status">{rulesMsg.text}</p>}
        </section>
      </div>
    </>
  );
}
