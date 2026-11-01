# Seok Social

App de social media dos 6 clientes da Seok (Metapel, Outbox, Content Lab, Pietro, Seok Wellness, Nap Griddle), em Google Apps Script com uma planilha como banco.

- **Visão geral:** um cartão grande por cliente com frequência real x meta (8 semanas), estoque de posts prontos e até quando cobre, próximo post, o foco do cliente (treinamento com PAX, próximo case, pedido, tema, tendência) e o último Reportei.
- **Página do cliente:** só os blocos que importam para ele (frequência editável, estoque, treinamentos da agenda com peças Story/Feed/LinkedIn, fila de cases, temas, tendências, pedidos), calendário, resultados e ajustes.
- **Resultados:** PDF da Reportei importado na mão; seguidores, orgânico x pago, o que deu certo e o que não funcionou e por quê.
- **Apresentação do mês:** slides prontos para a reunião (estratégia, objetivo, frequência, o porquê de cada post, Reportei, o que os números dizem, próximo mês), com Salvar PDF.

## Instalar

1. Crie uma planilha nova no Google Sheets › Extensões › Apps Script.
2. Cole `publicar/Codigo.gs` no `Código.gs`, crie o arquivo HTML `index` com `publicar/index.html`.
3. Configurações do projeto › marque "Mostrar arquivo de manifesto" e cole `publicar/appsscript.json`.
4. Implantar › Nova implantação › App da Web (executar como você). Para atualizar depois: Gerenciar implantações › editar › **Nova versão**.

## Desenvolver

```
node dev/servidor.js --demo   # http://localhost:8090 com dados fictícios
node --test test/             # testes do servidor
node dev/empacotar.js         # gera publicar/
```
