# Apuração 2º turno 2026 (ao vivo)

Painel da apuração com os arquivos oficiais do TSE (`resultados.tse.jus.br`):

- **Presidente, Brasil**: % dos válidos, votos, diferença, % de urnas apuradas, válidos, brancos, nulos, comparecimento, abstenção.
- **Cenários**: votos que faltam (estimativa), quanto cada um precisa dos votos restantes para virar ou garantir, estados na frente, comparação com o 1º turno, exterior, maiores vitórias e disputa mais apertada.
- **Evolução minuto a minuto**: gráfico por horário ou por % de urnas apuradas, do Brasil ou de qualquer estado.
- **Mapa por estado** (cor pelo líder e tamanho da vantagem) e **resultado por região** + exterior.
- **Tabela por estado**: % apurado, % e votos de cada candidato, margem, 1º turno, abstenção (ordenável).
- **Governadores no 2º turno**: aparecem sozinhos os estados que têm arquivo de 2º turno no TSE.

## Rodar

```
npm run apuracao
```

Abra http://localhost:8026. O servidor:

- repassa os arquivos do TSE ao navegador (evita bloqueio de CORS);
- lê Brasil, 27 estados, exterior e governadores **a cada 60 s** e grava o histórico em `apuracao/historico.json`,
  então o gráfico minuto a minuto continua crescendo mesmo com a página fechada.

Também dá para abrir `apuracao/index.html` direto no navegador: ele tenta buscar no TSE sem o servidor,
e o histórico fica só no navegador enquanto a página está aberta.

## Códigos usados

| Eleição | Código | Cargo | Arquivo |
|---|---|---|---|
| Presidente, 2º turno (25/10/2026) | 6258 | 1 | `/oficial/ele2026/6258/dados/{uf}/{uf}-c0001-e006258-u.json` |
| Governador, 2º turno | 6260 | 3 | `/oficial/ele2026/6260/dados/{uf}/{uf}-c0003-e006260-u.json` |
| Presidente, 1º turno (comparação) | 6257 | 1 | `/oficial/ele2026/6257/dados/{uf}/{uf}-c0001-e006257-u.json` |

`{uf}` em minúsculas; `br` = Brasil, `zz` = exterior. Variáveis do servidor: `PORT` (8026), `INTERVALO_S` (60).
