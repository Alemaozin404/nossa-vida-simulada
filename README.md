# Vida Financeira RP v2.0.0

Jogo de vida financeira em HTML, CSS e JavaScript, pronto para publicar no GitHub Pages.

O projeto não é apenas uma tela bonita: ele possui sistemas conectados de banco, trabalho, XP, cargos, promoções, empréstimos, impostos, casas, contas, atraso, investimentos, score, histórico, ranking, conquistas, notificações e salvamento local.

## O que funciona nesta versão

- Cadastro local de jogador.
- Saldo inicial e evolução financeira.
- Home com resumo da vida do jogador.
- Banco com visão geral, dívidas, contas, empréstimos, casas, investimentos e histórico.
- Trabalho com salário por cargo.
- Tarefas pagando 10% do salário atual.
- Limite de 10 tarefas a cada 24 horas.
- XP e promoção de cargo.
- Promoções altas com aprovação no painel Admin / CEO.
- Empréstimos com taxa de 5% a cada 3 horas.
- Dívidas, taxas, multas e pagamento pela aba Impostos.
- Casas com aluguel e contas a cada 10 horas.
- Atraso de casa/contas com aumento de 3% após 5 horas.
- Proposta de compra de 50% da casa após 5 pagamentos corretos.
- Compra gradual até 100%.
- Perda da casa com devolução de 5% em dívida grave.
- Investimentos com ciclos de valorização e risco.
- Score financeiro afetando crescimento.
- Histórico financeiro completo.
- Notificações visuais.
- Ranking local com NPCs.
- Salvamento em `localStorage`.
- Cálculo de tempo offline ao voltar ao jogo.
- PWA básico com `manifest.webmanifest` e `sw.js`.
- `server.js` opcional para rodar localmente ou em hospedagens Node.

## Como rodar localmente sem servidor

Abra o arquivo:

```txt
index.html
```

O jogo já funciona no navegador usando salvamento local.

## Como rodar com servidor local Node.js

Instale as dependências:

```bash
npm install
```

Inicie o servidor:

```bash
npm start
```

Depois abra:

```txt
http://localhost:3000
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie todos os arquivos do projeto para a raiz do repositório.
3. Vá em **Settings > Pages**.
4. Em **Build and deployment**, escolha **GitHub Actions**.
5. O workflow `.github/workflows/pages.yml` fará o deploy automaticamente.

Também é possível usar **Deploy from a branch** escolhendo a branch `main` e a pasta `/root`.

## Importante sobre servidor

GitHub Pages hospeda apenas arquivos estáticos: HTML, CSS, JS, imagens e arquivos públicos.

Isso significa que o GitHub Pages não executa `server.js`, banco de dados real ou Node.js.

Por isso esta versão foi feita em modo **local-first**:

- No GitHub Pages, o jogo funciona usando `localStorage`.
- Para multiplayer, login real, banco de dados online e rankings globais, use o front-end no GitHub Pages e hospede o backend em Render, Railway, Fly.io, VPS ou outro serviço Node.js.

O arquivo `server.js` já está incluído como base opcional para evolução futura.

## Estrutura

```txt
vida_financeira_rp/
├── index.html
├── style.css
├── data.js
├── script.js
├── manifest.webmanifest
├── sw.js
├── 404.html
├── server.js
├── package.json
├── README.md
├── assets/
│   └── icon.svg
├── server/
│   └── database.json
└── .github/
    └── workflows/
        └── pages.yml
```

## Próximas atualizações recomendadas

- Login com conta real.
- Backend com autenticação.
- Banco de dados online, como PostgreSQL, MongoDB ou Firebase.
- Ranking global real.
- Multiplayer com empresas controladas por jogadores.
- Mercado imobiliário entre jogadores.
- Eventos econômicos semanais.
- Painel admin protegido por senha.
- Sistema anti-cheat com validação no servidor.

## Observação de desenvolvimento

Ao atualizar o projeto, não remova sistemas existentes sem necessidade. A ideia é evoluir por módulos, mantendo compatibilidade com saves antigos sempre que possível.
