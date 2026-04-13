# 🛒 CZ Store — Sistema de Controle de Produtos

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?style=flat&logo=vercel)](https://cz-store-sigma.vercel.app)
[![Version](https://img.shields.io/badge/version-v2.3.0-e50914?style=flat)](https://github.com/Souzafx/cz-store/releases/tag/v2.3.0)
[![License](https://img.shields.io/badge/license-Personal-orange?style=flat)]()

**🌐 Produção:** https://cz-store-sigma.vercel.app

Sistema para cadastrar produtos da sua loja, acompanhar lucro, histórico de
compras/produção e se preparar para integração com marketplaces. Funciona
**100% local** (sem servidor) ou pode ser servido online como site estático.

Tema **dark gamer** (preto + vermelho), interface em catálogo de cards,
importação de planilha Excel e importação automática por link
(AliExpress, Shopee, Amazon, Mercado Livre…).

---

## ✨ Funcionalidades

### Cadastro e gestão
- ✅ Catálogo em grade de cards responsivos
- ✅ Descrição multilinha (pronta para integração com loja online)
- ✅ Imagem principal + **galeria de múltiplas imagens**
- ✅ Upload local de foto OU URL externa (prioridade para URL)
- ✅ Modal de detalhes completo com foto grande, badges e galeria clicável

### Custos e cálculos
- 💰 Suporta produtos **nacionais** e **importados** (com imposto separado)
- 🧮 Venda em **kits/pares** (comprar avulso, vender em kit de N)
- 📈 Cálculos automáticos: custo unitário, custo por kit, líquido após taxa,
  lucro por kit, lucro total, margem líquida, lucro sobre custo
- 🎯 **Sugestão de preço** para atingir % de lucro desejado
- ⚠️ Aviso quando a quantidade não é divisível pelo tamanho do kit

### Histórico de compras
- 📜 Cada produto pode ter **múltiplas compras** com data, quantidade,
  custo, imposto, origem e observação
- 🕒 **Timeline global** ordenada por hora (hora/minuto de registro)
- 🏷️ Destaque automático para a "última compra" registrada

### Importação
- 📥 **Importar planilha Excel (.xlsx)** — leitura inteligente de nomes de colunas
- 🌐 **Importar por link** — cola o link do AliExpress/Shopee/Amazon e o sistema
  extrai nome, imagens, descrição e preço via CORS proxy

### Dashboard
- 📊 Total investido, lucro total, margem média, quantidade de produtos
- 🏆 Top 5 mais lucrativos

### Persistência
- 💾 Tudo salvo em `localStorage` do navegador
- 🔄 Migração automática entre versões do modelo de dados

---

## 🛠️ Tecnologias

Projeto **vanilla web** (sem framework, sem build):

- **HTML5** + **CSS3** + **JavaScript ES6+** (sem transpilação)
- **[SheetJS](https://sheetjs.com/)** (`xlsx.full.min.js`) — leitura de planilhas
- **localStorage** — persistência local
- **CORS proxies públicos** (allorigins.win, corsproxy.io) — extração de links

### Por que não React/Vite?
O objetivo é que o sistema funcione **abrindo `index.html` com duplo-clique**,
sem `npm install`, sem build, sem servidor. Esta escolha vale mais que a
modularidade via bundler. O código está organizado em arquivos separados
carregados via `<script>` na ordem correta.

---

## 📁 Estrutura do projeto

```
CZ automação/
├── index.html                    # Ponto de entrada — abra este arquivo
├── css/
│   └── style.css                 # Tema dark gamer completo
├── js/
│   ├── utils/                    # Funções puras (sem DOM)
│   │   ├── format.js             # BRL, PCT, formatDate, escapeHtml, genId...
│   │   ├── images.js             # normalizeImageUrl, upgradeImageSize, dedupe...
│   │   └── calc.js               # calcProduct, calcPurchase, deriveOrigin
│   ├── storage.js                # Camada de persistência (localStorage)
│   └── app.js                    # UI, modais, renderização, importadores
├── lib/
│   └── xlsx.full.min.js          # Biblioteca SheetJS (versionada p/ funcionar offline)
├── README.md                     # Este arquivo
├── CHANGELOG.md                  # Histórico de versões
└── .gitignore
```

### Princípios de organização

1. **Pasta `utils/`** → funções puras, sem dependência de DOM, fáceis de testar
2. **`storage.js`** → camada isolada de persistência (pode ser trocada por API/SQLite)
3. **`app.js`** → orquestração: estado, modais, eventos, renderização
4. **`lib/`** → bibliotecas externas versionadas localmente
5. **`css/`** → todos os estilos em um único arquivo com seções bem comentadas

---

## ▶️ Como rodar localmente

### Pré-requisito: nenhum
Não precisa instalar Node, npm, Python ou qualquer coisa.

### Passo único
1. Baixe/clone este repositório
2. **Duplo clique em `index.html`** — abre no navegador padrão
3. Pronto. Já está funcionando.

> 💡 **Recomendado:** abrir no **Google Chrome** (botão direito → Abrir com → Chrome).
> Safari funciona, mas algumas importações de imagem via proxy podem ser bloqueadas.

### Clonando do GitHub

```bash
git clone https://github.com/Souzafx/cz-store.git
cd cz-store
open index.html    # macOS
# ou: start index.html (Windows) / xdg-open index.html (Linux)
```

---

## 🚀 Como versionar

Este projeto segue **[Semantic Versioning](https://semver.org/lang/pt-BR/)**:

```
MAJOR.MINOR.PATCH
   │     │     └── bugfix, ajuste pequeno que não muda comportamento (v2.0.1)
   │     └──────── nova funcionalidade compatível com versões anteriores (v2.1.0)
   └────────────── mudança grande, quebra de compatibilidade (v3.0.0)
```

### Exemplos práticos

| Mudança | Tipo | Versão antes → depois |
|---|---|---|
| Corrige cálculo de lucro | `patch` | `v2.0.0` → `v2.0.1` |
| Adiciona filtro por data no histórico | `minor` | `v2.0.1` → `v2.1.0` |
| Remove suporte para localStorage (migra p/ SQLite) | `major` | `v2.1.0` → `v3.0.0` |

### Criando uma release com tag

```bash
git tag -a v2.1.0 -m "Adiciona filtro por data no histórico"
git push origin v2.1.0
```

No GitHub, vá em **Releases → Draft a new release → Choose a tag**.

---

## 🌿 Padrão de branches

```
main             ← sempre estável, pronto para usar
  │
  └── dev        ← integração, próximos testes
        │
        ├── feature/nome-da-funcionalidade   ← novas features
        ├── fix/descricao-do-bug             ← correções
        ├── refactor/area-refatorada         ← reorganização de código
        └── docs/o-que-foi-documentado       ← só documentação
```

### Fluxo típico

```bash
# Começa uma feature
git checkout dev
git pull
git checkout -b feature/exportar-produtos

# ... faz mudanças ...

git add .
git commit -m "feat: adiciona exportação para CSV"
git push -u origin feature/exportar-produtos

# Abre PR no GitHub: feature/exportar-produtos → dev
# Depois de revisar: merge

# Quando dev estiver estável, promove para main
git checkout main
git merge dev
git tag -a v2.1.0 -m "Release v2.1.0"
git push origin main --tags
```

---

## 💬 Padrão de commits (Conventional Commits)

Use prefixos para deixar o histórico legível:

| Prefixo | Uso | Exemplo |
|---|---|---|
| `feat:` | Nova funcionalidade | `feat: adiciona galeria de imagens por link` |
| `fix:` | Correção de bug | `fix: corrige cálculo de lucro por kit` |
| `style:` | Ajuste visual/CSS (sem lógica) | `style: ajusta espaçamento do modal de compra` |
| `refactor:` | Reorganização de código | `refactor: extrai utils para pasta separada` |
| `docs:` | Documentação | `docs: atualiza README com novo padrão` |
| `chore:` | Tarefas de infra | `chore: atualiza .gitignore` |
| `perf:` | Melhoria de performance | `perf: deduplica imagens da galeria` |
| `test:` | Testes | `test: adiciona teste do calcProduct` |

### Regras simples
- Primeira linha em **letras minúsculas**, imperativo, **máx. 72 caracteres**
- Sem ponto final
- Pode ter corpo separado por linha em branco
- Referencia issues/PRs: `fix: corrige import (#42)`

---

## 🐙 Como subir para o GitHub (primeira vez)

```bash
# 1. Dentro da pasta do projeto
cd "/Users/davyd.dg12gmail.com/Documents/CZ automação"

# 2. Inicializar o git (se ainda não tiver)
git init

# 3. Adicionar tudo (exceto o que está no .gitignore)
git add .

# 4. Primeiro commit
git commit -m "feat: versão inicial do sistema de produtos CZ Store"

# 5. Renomear branch para main (convenção moderna)
git branch -M main

# 6. Criar o repositório no GitHub (via site) e conectar:
git remote add origin https://github.com/Souzafx/cz-store.git

# 7. Empurrar para o GitHub
git push -u origin main
```

> 💡 **Dica:** crie o repositório no GitHub **vazio** (sem README, sem .gitignore,
> sem licença) — esses arquivos já estão aqui. Senão vai dar conflito no push.

### Para criar o branch de desenvolvimento

```bash
git checkout -b dev
git push -u origin dev
```

Depois disso no GitHub, vá em **Settings → Branches → Default branch** e
pode configurar `main` como protegido (só aceita merge via PR).

---

## 🔮 Futuro (roadmap)

- [ ] Exportação de produtos para CSV/JSON
- [ ] Integração direta com Shopee/Mercado Livre via API oficial
- [ ] Dashboard financeiro com gráficos de lucro ao longo do tempo
- [ ] Backup automático (download do JSON do localStorage)
- [ ] Suporte a múltiplas lojas
- [ ] Modo PWA (instalável)
- [ ] Baixar imagens externas como base64 (independência do CDN)

---

## 💾 Backup manual dos dados

Os dados ficam em `localStorage` do navegador. Para fazer backup, abra o Console
(⌥⌘J no Chrome) e execute:

```js
// Exportar:
copy(localStorage.getItem("cz_products_v1"));
// (cole num .txt para backup)

// Restaurar:
localStorage.setItem("cz_products_v1", `COLE_AQUI`);
location.reload();

// Limpar tudo:
Storage.clear();
location.reload();
```

---

## 📝 Licença

Projeto pessoal — uso livre para a loja CZ Store.

---

🔥 Desenvolvido com tema dark gamer para controle profissional de loja.
