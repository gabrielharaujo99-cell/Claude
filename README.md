# Flow CRM

CRM em Kanban para agências, construído do zero no Google Apps Script, com uma Planilha Google como banco de dados.
Marca, funil, listas e equipe são configuráveis por agência, sem mexer em código.

**Status:** em construção. O servidor (`src/*.gs`) está pronto e testado; a tela (`src/ui/`) ainda vai ser feita.

## Estrutura

- `src/`: código que vai para o Apps Script (`appsscript.json`, `*.gs` e, depois, `ui/*.html`).
- `dev/gas.js`: simulador do Apps Script para rodar o servidor no Node.
- `test/`: testes automáticos do servidor.

## Testes

```
npm test
```
