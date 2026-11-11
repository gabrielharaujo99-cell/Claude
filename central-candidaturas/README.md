# Órbita · CRM de candidaturas

CRM pessoal de candidaturas de emprego em Google Apps Script.

- `Code.gs`: backend. Na primeira execução cria a planilha **Central de Candidaturas** no Google Drive e a preenche com os dados de `SEED` (vazio aqui, porque o repositório é público).
- `Index.html`: a interface (resumo por etapa, quadro "Ação sua" / "Em processo" e tabela com busca). Mudar a etapa de uma vaga grava direto na planilha.
- `appsscript.json`: manifesto. O web app roda como o dono e só o dono acessa (`MYSELF`).

## Publicar

1. Crie um projeto em <https://script.google.com>, cole `Code.gs`, `Index.html` e o manifesto.
2. Implantar → Nova implantação → App da Web → Executar como: **eu** → Quem pode acessar: **Somente eu**.
3. Autorize o acesso às Planilhas na primeira abertura.

Para adicionar ou editar candidaturas, edite a planilha: o web app lê dela a cada abertura.

## Agentes de IA (v2.0)

12 agentes com o Gemini: Caçador de vagas, Raio-X da vaga, Analista de CV, Montador de CV, Otimizador de LinkedIn, Dossiê da empresa, Plano da semana, Coach de entrevista, Redator de mensagens, Negociador salarial, Follow-up em massa e Pergunte ao Bit.
Cada usuário cola a própria chave do Gemini (grátis em aistudio.google.com/apikey), o CV e o perfil em **Ajustes**. Tudo fica nas Propriedades do usuário do Apps Script.
