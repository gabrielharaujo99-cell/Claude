# Seok Flow

CRM em Kanban para agências, construído do zero no Google Apps Script, com uma Planilha Google como banco de dados.
Marca, funil, listas e equipe são configuráveis por agência, sem mexer em código.

**Status:** servidor (`src/*.gs`) e tela (`src/ui/`) prontos. A configuração padrão é a da Seok Wellness
(marca, logo e listas focadas em wellness: esporte, longevidade, saúde e recovery).

## Estrutura

- `src/`: código que vai para o Apps Script (`appsscript.json`, `*.gs` e `ui/*.html`).
- `src/ui/`: a tela. `index` junta `estilos` e os scripts (`js-base`, `js-inicio`, `js-funil`, `js-oportunidade`, `js-telas`, `js-admin`).
- `src/Financeiro.gs` + `src/ui/js-financeiro.html`: contratos dos clientes, reajustes e serviços adicionais.
  Só vê quem tem "Financeiro" marcado em Admin > Equipe (é por pessoa, não por papel).
- `src/EquipeSeok.gs`: equipe inicial (nomes, e-mails, cargos, acesso ao financeiro). **Fica fora do Git**
  porque o repositório é público; o formato está em `src/EquipeSeok.exemplo.gs.txt`. Precisa ir junto para o Apps Script.
- `dev/gas.js`: simulador do Apps Script para rodar o servidor no Node.
- `dev/servidor.js`: abre a tela no navegador usando o simulador.
- `test/`: testes automáticos do servidor.

## Rodar a tela localmente

```
npm run dev
```

Abre em http://localhost:8080 como o primeiro admin de `src/EquipeSeok.gs` (dono simulado da planilha; `FLOW_DONO=email` troca). Para entrar como outra pessoa:
`?como=email@dominio`. Os dados ficam em `dev/.dados.json` (apague o arquivo para começar do zero).

## Testes

```
npm test
npm run smoke
```
