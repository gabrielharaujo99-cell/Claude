# Publicar o Seok Flow novo no Apps Script (cole isto numa conversa LOCAL do Claude Desktop com o Claude in Chrome)

Publique a versão nova do Seok Flow no Apps Script, usando o Claude in Chrome (autorizado).

1. No clone local do repositório:
   git fetch origin claude/crm-company-analysis-5b46yr && git checkout claude/crm-company-analysis-5b46yr && git pull
   node dev/empacotar.js --pessoal
   (gera dist/Codigo.gs, dist/index.html e dist/appsscript.json; se existir src/EquipeSeok.gs, ele entra junto)
2. No Chrome, abra a planilha "Seok Flow (teste)":
   https://docs.google.com/spreadsheets/d/1qfdCdmMohlEBibFL59DcLB2N7Z_TXKFVQa3-p-WOqnM/edit
   e vá em Extensões > Apps Script. Em Implantar > Gerenciar implantações, confira que o ID é o do link:
   https://script.google.com/macros/s/AKfycbwqK0WzTcrla-RQgygQTtiqsif0nD5cKpvFqNuwmuzpleuhGXxbKg4to7370jCcmrGaKw/exec
3. Backup: copie o conteúdo atual de cada arquivo do editor para a pasta local backup-apps-script/.
   Se o código atual tiver EQUIPE_INICIAL, APELIDOS, APRESENTAR_COMO ou CONFIG_AGENCIA e o dist/Codigo.gs não tiver,
   cole esses blocos no fim do Codigo.gs novo (sem APELIDOS, contas Gmail podem perder o acesso).
4. Cole dist/Codigo.gs no arquivo de código principal (apague .gs antigos que viraram parte dele, para não duplicar funções),
   dist/index.html no arquivo HTML ui/index, e dist/appsscript.json no manifesto
   (Configurações do projeto > Mostrar arquivo de manifesto). Salve.
5. Implantar > Gerenciar implantações > editar a implantação existente > Nova versão > Implantar.
   NÃO crie implantação nova (o link mudaria). Aprove as permissões novas (Agenda e Docs).
6. Abra o link /exec e confira o visual novo (menu claro, Cockpit, aba Quadro e Resultados na social).
   Se der erro, restaure o backup.
