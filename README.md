# Vida Financeira RP v2.5.0

Jogo web real de vida financeira em HTML, CSS e JavaScript, preparado para GitHub Pages e expansão futura com backend/multiplayer.

## O que é

O jogador começa com pouco dinheiro e precisa crescer financeiramente trabalhando, pagando contas, cuidando do score, pegando empréstimos com responsabilidade, alugando/comprando casas, investindo e evoluindo socialmente.

A versão atual é **local-first**: funciona direto no navegador e salva o progresso no `localStorage`. Não usa dinheiro real. O jogo é real como software funcional, mas a economia é fictícia dentro do jogo.

## Como rodar localmente

Abra o arquivo `index.html` no navegador.

Para testar como servidor local:

```bash
npx serve .
```

ou:

```bash
python -m http.server 8080
```

## Como publicar no GitHub Pages

Suba o conteúdo da pasta do projeto para o GitHub:

```txt
index.html
style.css
script.js
data.js
README.md
404.html
.nojekyll
manifest.webmanifest
sw.js
assets/
.github/
```

Depois vá em **Settings > Pages** e publique pela branch `main`, pasta `/root`.

## Sistemas existentes

- Cadastro local de jogador
- Home com painel financeiro
- Banco com extrato, dívidas, contas, empréstimos, casas e investimentos
- Trabalho com salário, XP, cargos e promoção
- Limite de 10 tarefas a cada 24 horas
- Energia, cansaço e desempenho profissional
- Empréstimos com taxa obrigatória de 5% a cada 3 horas
- Simulador de empréstimos antes da confirmação
- Casas com aluguel/contas a cada 10 horas
- Multa de 3% após 5 horas de atraso
- Proposta de compra de 50% após 5 pagamentos corretos
- Compra total da casa
- Venda, reforma e aluguel para NPC
- Impostos e dívidas com pagamento total/parcial
- Investimentos com ciclos, risco e gráfico simples
- Eventos de mercado
- Score financeiro
- Metas diárias
- Conquistas
- Loja com itens funcionais
- Histórico com filtro e busca
- Ranking local
- Admin/CEO com aprovação de promoções e ajustes
- Notificações
- Salvamento automático/manual
- Exportar/importar save
- Backup local
- Cálculo de tempo offline
- Estrutura preparada para backend futuro

## Fórmulas principais

```txt
ganhoPorTarefa = salarioAtual * 0.10
limiteDiarioTarefas = 10 tarefas / 24 horas
taxaEmprestimo = valorEmprestimo * 0.05 a cada 3 horas
atrasoCasa = valorAtual + 3% após 5 horas de atraso
compra50 = liberada após 5 pagamentos corretos
devolucaoCasaPerdida = valorTotalCasa * 0.05
lucroAluguel = aluguelRecebido - contasDaCasa
```

## Atualização v2.5.0

Esta atualização preserva a base anterior e adiciona sistemas novos sem recriar o jogo do zero:

- Visual mais premium e dashboard mais vivo
- Cards inteligentes na Home
- Central bancária mais completa
- Pagamento parcial de dívidas
- Energia, fadiga e desempenho no trabalho
- Tarefas raras/urgentes com bônus real
- Metas diárias com recompensa
- Loja com itens úteis e efeitos reais
- Eventos de mercado para investimentos
- Gráfico simples de valorização
- Save exportável/importável
- Histórico filtrável e pesquisável
- Melhor preparação para multiplayer futuro

## Backend/multiplayer futuro

O GitHub Pages hospeda apenas o front-end. Para multiplayer real, use uma das opções:

- Supabase Auth + Postgres + Realtime
- Firebase Auth + Firestore/Realtime Database
- Node.js em Render/Railway/VPS

O ideal é mover regras sensíveis para o servidor:

- saldo
- XP
- empréstimos
- juros
- pagamentos
- ranking global
- promoções CEO
- casas entre jogadores

## Observação importante

Não apague o save do jogador sem permissão. O sistema tem migração para versões antigas e tenta preservar os dados existentes.
