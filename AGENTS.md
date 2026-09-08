# Instrucoes do projeto

## Atualizacao obrigatoria de tarefas

Depois de qualquer implementacao, correcao ou alteracao relevante, atualize `TASKS.md` na mesma tarefa.

Regras:

- Organize o acompanhamento por camada: raiz/infraestrutura, shared types, banco/persistencia, backend/REST, gateway/realtime, frontend, IA, relatorios e qualidade.
- Marque `[x]` somente quando o item estiver implementado e verificado.
- Marque `[~]` quando existir implementacao parcial.
- Mantenha `[ ]` para requisitos ainda nao implementados.
- Registre testes executados na secao de qualidade.
- Compare sempre com requisitos de `prompt.md`.
- Nao marque como concluido algo que exista apenas como estrutura ou mock.
- Ao finalizar uma tarefa, deixe pendencias explicitas e atualize a ordem recomendada quando necessario.

## Padrao de idioma no codigo

- Todo codigo — variaveis, funcoes, classes, tipos, nomes de arquivos, chaves de objetos, contratos e identificadores em geral — deve ser escrito em ingles.
- Textos visiveis de UI, mensagens de erro exibidas ao usuario, rotulos e respostas de API (campos como mensagens de erro/sessao) podem ser em portugues.
- Cobrir os textos de UI/API em portugues com acentos corretos e grafia correta.
- Internacionalizacao para o ingles ficara para um futuro; ao criar textos, prefira manter centralizado/constante quando viavel para facilitar isso depois.

## Verificacao

Antes de concluir, leia `TASKS.md`, confirme que os itens refletem o estado real do repositorio e inclua arquivos, comandos ou testes relevantes quando ajudarem a localizar o trabalho.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
at `specs/002-user-auth-rooms/plan.md`.
<!-- SPECKIT END -->
