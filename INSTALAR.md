# Instalar o Flowloop numa agência nova

Tempo estimado: 30 a 60 minutos. Tudo fica no Google da agência: ela é dona dos dados.

## Antes
- A agência usa **Google Workspace** (e-mail @agencia.com.br no Google). Com Gmail pessoal funciona, mas aparece a faixa "criado por um usuário do Google Apps Script".
- Quem instala precisa estar logado na conta do **admin da agência** (ou receber acesso de editor à planilha).
- Gere os arquivos: `node dev/empacotar.js --neutro`. Eles saem em `dist/neutro/`.

## Passo a passo
1. Na conta da agência, crie uma **Planilha Google** nova chamada "Flowloop".
2. Abra **Extensões › Apps Script**. Dê ao projeto o nome "Flowloop".
3. No editor:
   - Apague o conteúdo de `Código.gs` e cole `dist/neutro/Codigo.gs`.
   - Crie um arquivo HTML chamado **`ui/index`** (Arquivo › + › HTML) e cole `dist/neutro/index.html`.
   - Em **Configurações do projeto**, marque "Mostrar arquivo de manifesto `appsscript.json`" e cole `dist/neutro/appsscript.json`.
     Use a versão sem `--pessoal` se a agência tiver Workspace (acesso pelo domínio).
   - Salve (Ctrl+S).
4. **Implantar › Nova implantação › App da Web**:
   - Executar como: **Eu** (o admin da agência).
   - Quem pode acessar: **Qualquer pessoa no domínio da agência** (Workspace) ou **Somente eu** (Gmail).
   - Autorize as permissões quando o Google pedir (é a conta da agência autorizando o próprio sistema).
5. Abra o link do app. O **assistente de boas-vindas** pede nome, logo, cor, segmentos e equipe.
6. Escolha "Começar do zero" ou "Ver com dados de exemplo" (para treinar a equipe e apagar depois).
7. Compartilhe o link com a equipe. Cada pessoa entra com a própria conta Google e vê só a área dela.

## Depois
- Peça para ser adicionado como **editor da planilha** para dar suporte e atualizar versões.
- Para atualizar: gere de novo com `--neutro`, cole os dois arquivos, salve e em **Implantar › Gerenciar implantações** edite a implantação com **Nova versão**. O link não muda, e quem estiver com o app aberto vê o aviso "Saiu uma versão nova".
- Opcional: um arquivo privado com `CONFIG_AGENCIA` e `EQUIPE_INICIAL` (modelo em `src/EquipeSeok.exemplo.gs.txt`) deixa a instalação já pronta antes do primeiro acesso.

## Demonstração
- Local: `npm run demo` abre a **Agência Aurora** (fictícia) em http://localhost:8081, com equipe, clientes e números de exemplo.
- Instalação limpa para ensaiar o assistente: `npm run limpo` (http://localhost:8082).
- Para uma demo online, instale como acima usando `dist/demo/` (gerado com `--demo`) numa conta sua e carregue o exemplo.
