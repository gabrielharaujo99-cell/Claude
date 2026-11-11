# Órbita · CRM de candidaturas (Google Apps Script)

Web app em Apps Script: `Code.gs` (backend, planilha e agentes Gemini) e `Index.html` (toda a interface, um arquivo só).

## Como trabalhar
- Publicar código no projeto do Apps Script: `npx @google/clasp push` (o `.clasp.json` já aponta para o projeto).
- Nova versão do web app: `npx @google/clasp deploy -i <deploymentId> -d "descrição"` (pegue o id com `npx @google/clasp deployments`).
- Primeira vez na máquina: `npx @google/clasp login`.

## Regras do código
- O repositório é público: `SEED` e `SALARIOS` ficam vazios aqui. Dados reais só no projeto do Apps Script.
- Interface: tema escuro neon (ciano #00e5ff, violeta #7b5cff, magenta #ff2bd6), Google Sans, vidro e grade de fundo. Mascote: Bit.
- Navegação por views (`data-view` / `data-ir`), menu lateral no estilo do Seok Social.
- Agentes: adicionar um prompt em `PROMPTS` no `Code.gs` e uma view com `form.agform[data-ag="<id>"]` no `Index.html`.
- Chave do Gemini, CV e perfil ficam nas Propriedades do usuário (`PropertiesService.getUserProperties()`), nunca no código.
