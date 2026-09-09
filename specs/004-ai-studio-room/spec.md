# Feature Specification: Studio de IA por Mesa (AI Studio com escopo de sala)

**Feature Branch**: `004-ai-studio-room`

**Created**: 2026-09-07

**Status**: Draft

**Input**: Descrição do usuário: "criamos o studio de IA, mas ela fica vinculada somente ao usuario PO, mas se um dia o PO não poder acessar a mesa, ela fica sem IA, podemos então abrir um studio para a mesa tambem, e esse agente fica vinculado só a mesa, diferente do agente criado pelo usuario que fica vinculado a ela e ele pode colocar em qualquer mesa. Então quero ciar um studio de IA para a sala, esse agente fica somente pra essa mesa."

## Resumo

Hoje o Studio de IA fica **vinculado à conta** (persona, regras de negócio e credenciais de provedor LLM pertencem ao usuário dono da sala). Quando o PO configura a IA, essa configuração viaja com a conta dele e é reutilizada em qualquer mesa que ele dirija. Isso cria um ponto único de dependência: **se o PO não conseguir acessar a mesa (sair, perder acesso, não estar presente), a mesa fica sem IA**, mesmo que ela já tenha sido usada com IA antes.

Esta feature cria um **Studio de IA com escopo de mesa (sala)**. Uma mesa passa a ter sua própria configuração de IA — agente (persona), regras de negócio e provedor LLM — gravada **na própria sala**, de modo que a IA da mesa continua ativa independentemente de quem seja o PO e de ele possuir ou não um Studio na conta.

Ficam claros dois níveis de escopo:

- **Agente de conta**: vinculado a um usuário; o dono pode usá-lo em qualquer mesa que dirija.
- **Agente de mesa**: vinculado a uma única sala; fica registrado na sala e só vale para aquela mesa.

## Clarifications

### Session 2026-09-08

- Q: Um PO que não tem conta (guest que criou a mesa) pode configurar o Studio de IA da sala, ou só donos logados? → A: Só dono logado em conta edita o Studio de IA da mesa. PO guest continua usando a mesa com IA (cai nos padrões/env), mas não configura o studio da sala.
- Q: Quando a mesa tem Studio próprio mas nenhuma regra de negócio salva, a IA herda as regras da conta do dono ou fica sem regras? → A: Herda da conta do dono (granularidade completa por recurso: cada recurso — provedor, persona, regras — resolve mesa → conta → default).
- Q: Existe forma de limpar o Studio de IA da mesa pra ela voltar a seguir o Studio da conta, ou é permanente? → A: Sem reset em massa — o dono volta ao comportamento da conta desconfigurando campo a campo (regras vazias, campo de token vazio, persona com prompt padrão); a precedência granular já faz os campos ausentes herdar da conta.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configurar a IA direto na mesa (Priority: P1)

O dono da mesa abre as configurações da sala e encontra um painel "Studio de IA da mesa". Nele pode definir a persona do agente (nome, avatar, prompt), as regras de negócio e, se quiser, as credenciais do provedor LLM — tudo salvo **na própria mesa**. A IA passa a usar essa configuração nas sessões de planning da mesa.

**Why this priority**: é o núcleo da feature — dá à mesa uma IA própria e desacoplada da conta do PO, resolvendo o problema relatado de "mesa sem IA quando o PO não acessa".

**Independent Test**: Criar uma mesa, configurar o Studio de IA da mesa com um provedor e persona próprios, e rodar uma sessão de planning com IA. A IA vota e participa usando a persona/regras/provedor da mesa — mesmo que a conta do dono **não** tenha nenhum Studio configurado.

**Acceptance Scenarios**:

1. **Given** uma mesa existente com IA habilitada e o dono autenticado, **When** ele abre as configurações da sala e salva uma persona, regras e provedor no Studio de IA da mesa, **Then** a configuração fica persistida e associada àquela sala.
2. **Given** uma mesa com Studio de IA da mesa configurado e uma conta de dono **sem** Studio de conta, **When** a IA vota em uma história, **Then** a IA usa a persona, as regras e o provedor da mesa e retorna o voto normalmente.
3. **Given** uma mesa com Studio de IA da mesa configurado, **When** a mesa é aberta de novo em outra sessão, **Then** a configuração da mesa permanece e a IA continua usando-a.

---

### User Story 2 - Precedência: mesa > conta > padrão do sistema (Priority: P2)

Quando uma mesa participa de uma sessão com IA, a configuração usada é resolvida por precedência: **configuração da mesa** primeiro; se não existir, **configuração da conta** do dono; se não existir, **padrões de ambiente** do sistema. Isso garante que quem configurou a mesa tem controle sobre ela, sem quebrar quem já usa o Studio de conta.

**Why this priority**: define de forma determinística qual configuração a IA usa e dá segurança de que a mesa não fica sem IA quando não há configuração própria — mantém compatibilidade com o comportamento atual.

**Independent Test**: Configurar uma mesa sem Studio de mesa, mas com Studio de conta no dono → a IA usa o Studio de conta. Depois configurar o Studio de mesa → a IA passa a usar o da mesa.

**Acceptance Scenarios**:

1. **Given** uma mesa sem Studio de mesa e um dono com Studio de conta, **When** a IA vota, **Then** a IA usa a persona/regras/provedor da conta do dono.
2. **Given** uma mesa com Studio de mesa e um dono com Studio de conta, **When** a IA vota, **Then** a IA usa a persona/regras/provedor da mesa (mesa tem prioridade sobre a conta).
3. **Given** uma mesa sem Studio de mesa e um dono sem Studio de conta, **When** a IA vota, **Then** a IA usa os padrões de ambiente do sistema (comportamento atual preservado).

---

### User Story 3 - Só o dono edita a IA da mesa (Priority: P3)

A configuração do Studio de IA da mesa só pode ser lida e editada pelo **dono da mesa**. Participantes em geral não enxergam credenciais e não conseguem alterar persona/regras/provedor. O servidor valida identidade, participação e papel antes de permitir leitura/escrita.

**Why this priority**: segue o princípio de segurança do projeto (ações administrativas validadas no servidor) e impede que um participante injete regras ou troque credenciais da IA da mesa.

**Independent Test**: Entrar em uma mesa como participante comum e tentar abrir/alterar o Studio de IA da mesa → o servidor rejeita; entrar como dono → consegue.

**Acceptance Scenarios**:

1. **Given** um participante comum na mesa, **When** ele tenta salvar alterações no Studio de IA da mesa, **Then** o servidor rejeita a operação (sem alterar a configuração).
2. **Given** o dono da mesa autenticado em conta, **When** ele abre o Studio de IA da mesa, **Then** ele vê as credenciais mascaradas (nunca o token em claro) e pode salvar alterações.
3. **Given** uma sessão de planning com IA em andamento, **When** o dono altera a configuração da mesa, **Then** a próxima chamada de IA usa a nova configuração.

---

### Edge Cases

- **Sem provedor na mesa nem na conta**: a IA cai nos padrões de ambiente; se também não houver credenciais de ambiente, a chamada falha com o erro já existente de configuração — a mesa não quebra, apenas não consegue chamar o LLM.
- **Dono sem conta/convite expirado**: mesmo se o dono não estiver acessível, a configuração da mesa persiste e a IA continua ativa usando os dados da sala.
- **Token de provedor da mesa vazio**: ao editar o provedor da mesa mantendo um token já salvo, o campo vazio significa "manter o atual" (mesmo padrão do Studio de conta).
- **Participante tenta editar**: operação rejeitada pelo servidor; a UI esconde o painel ou o desabilita.
- **Studio parcial na mesa**: uma mesa com persona própria mas sem regras/provedor herdados da conta; revertido ao remover o campo próprio. Sem dono válido (guest/owner removido), a resolução cai nos padrões de ambiente, como hoje.
- **Deleção de mesa**: a configuração de IA da mesa é removida junto com a sala (mesmo ciclo de vida).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir ao dono da mesa configurar um Studio de IA com escopo de sala, contendo persona do agente (nome, avatar, prompt), regras de negócio e, opcionalmente, provedor LLM (nome, host, modelo, token).
- **FR-002**: O sistema DEVE persistir a configuração de IA da mesa associada à sala, com o mesmo ciclo de vida da sala (removida quando a sala é removida).
- **FR-003**: O sistema DEVE resolver a configuração de IA de uma sessão por precedência **granular por recurso**: para cada recurso (persona, regras de negócio, provedor LLM), mesa → conta do dono → padrões de ambiente. Uma mesa sem regras próprias DEVE herdar as regras da conta; uma mesa sem provedor próprio DEVE herdar o provedor da conta.
- **FR-004**: O sistema DEVE usar a configuração da mesa nas chamadas de IA (voto, discussão, sumarização e insights) sempre que a mesa tiver Studio configurado, mesmo que a conta do dono não tenha.
- **FR-005**: O sistema DEVE aplicar os guardrails existentes (proteção contra prompt injection, sistema sempre se autoprotege) ao contexto fornecido pela mesa, com o mesmo rigor aplicado hoje ao contexto de conta.
- **FR-006**: O sistema DEVE validar no servidor que somente o dono da mesa **autenticado em conta** pode ler e editar o Studio de IA da mesa; participantes comuns e donos guest DEVENDO ter a operação rejeitada (dono guest segue usando a IA da mesa com os padrões).
- **FR-007**: O sistema DEVE exibir o token do provedor da mesa sempre mascarado (nunca em claro) e permitir mantê-lo ao editar com o campo vazio.
- **FR-008**: O sistema DEVE preservar o comportamento atual do Studio de conta: o agente de conta permanece vinculado ao usuário e aplicável a qualquer mesa que ele dirija, com a precedência da mesa à frente.
- **FR-009**: O sistema DEVE permitir que o dono reverta a mesa ao comportamento da conta desconfigurando campo a campo (regras vazias, provedor sem token mantendo o padrão da conta); não há reset em massa do studio da mesa.

### Key Entities

- **Studio de IA da mesa (Room AI Studio)**: configuração de IA própria de uma sala — persona, regras de negócio e provedor LLM. Um por sala, removido com a sala.
- **Agente de mesa**: persona (nome, avatar, prompt) vinculada a uma sala específica, usada quando a mesa tem prioridade na resolução.
- **Provedor LLM de mesa**: credenciais de conexão (host, modelo, token) vinculadas a uma sala; opcional — quando ausente, a resolução cai para conta/ambiente.
- **Regras de negócio de mesa**: regras de contexto da sala; quando a mesa não tem regras próprias, herda as regras da conta do dono.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Uma mesa com apenas o Studio de mesa configurado (conta do dono sem Studio) roda uma sessão de planning com IA com sucesso — o dono conclui a criação da configuração em até 2 minutos.
- **SC-002**: Ao remover/desvincular a configuração de IA da conta do dono, a IA de uma mesa que possui Studio de mesa continua funcionando sem qualquer mudança manual.
- **SC-003**: Alterações no Studio de IA da mesa entram em vigor na próxima chamada de IA, sem reiniciar a mesa nem reconfigurar a conta.
- **SC-004**: 100% das tentativas de edição do Studio de mesa por participantes que não são donos são rejeitadas pelo servidor.
- **SC-005**: Nenhum fluxo regressa no comportamento atual: mesas que usam o Studio de conta seguem usando-o quando não há Studio de mesa.

## Assumptions

- **Precedência granular por recurso (mesa > conta > ambiente)**: cada recurso (provedor, persona, regras de negócio) resolve independentemente — uma mesa pode ter persona própria e provedor/regras herdados da conta. Documentada e testada; não requer escolha do usuário.
- **Edição restrita ao dono com conta**: a permissão de edição do Studio de mesa é exclusiva do dono da mesa autenticado em conta (regra padrão de segurança do projeto). Participantes comuns e donos guest têm acesso oculto/negado no servidor — não é criado um segundo mecanismo de autenticação por token de sessão da sala.
- **Provedor de mesa opcional**: uma mesa pode ter persona e regras próprias mas herdar o provedor (conta ou ambiente). A mesa também pode ter provedor próprio, caso o PO não queira usar o token da conta.
- **UI no painel de configurações da sala**: o Studio de IA da mesa é editado dentro das configurações da própria sala, ao lado de onde a IA é habilitada — não na página global /studio.
- **Mesmas regras de guardrail**: o contexto da mesa passa pela mesma proteção contra prompt injection já implementada; o sistema sempre se autoprotege, sem opção de desativar.
- **Reuso da arquitetura de conta**: a implementação paralela as tabelas existentes (provedor, agente, regras) chaveando por sala em vez de por usuário, reaproveitando o resolvedor de contexto como ponto de integração.
- **Mesmo padrão de token**: o token do provedor de mesa usa o mesmo fluxo de "campo vazio mantém o atual" e exibição mascarada do Studio de conta.
- **Sem reset em massa**: não há endpoint/botão de "limpar studio da mesa"; a reversão ao comportamento da conta acontece desconfigurando campo a campo, aproveitando a precedência granular já definida.
