# Changelog

Todas as mudanças importantes deste projeto são documentadas aqui.
O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e
o versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [2.0.0] — Versão atual

### Adicionado
- 🌐 **Importar do link** — cola um link de produto (AliExpress, Shopee, Amazon, Mercado Livre, Magalu) e o sistema extrai nome, imagens, descrição e preço automaticamente via CORS proxy com fallback em cascata.
- 🖼️ **Galeria de múltiplas imagens** — extração inteligente de várias fotos (og:image, JSON-LD, `<img>` tags, regex, `imagePathList` do AliExpress, `images[]` do Shopee), com grade de seleção, imagem principal e galeria extra.
- 📝 **Descrição do produto** — textarea multilinha no cadastro, exibida na tela de detalhes com botão "Copiar descrição" para integração futura com marketplaces.
- 🪟 **Modal de detalhes do produto** — clique no card abre uma visão completa (foto grande, badges de origem, descrição, financeiro detalhado, estoque, histórico).
- 📜 **Histórico de compras por produto** — cada produto pode ter múltiplas compras, cada uma com data, quantidade, custo, imposto, origem (nacional/importado) e observação.
- 🕒 **Timeline global de compras** — nova aba "Histórico" com linha do tempo de todas as compras, ordenadas por hora de registro, destacando a última.
- 💰 **Modelo de custo nacional/importado** — separação entre "custo do produto" e "imposto / taxas adicionais".
- 🧮 **Lógica de kits/pares** — comprar em unidades avulsas e vender em kits/pares com cálculo correto de lucro.
- 🎯 **Sugestão de preço automática** — dado um % de lucro desejado, o sistema calcula o preço de venda ideal considerando taxas da plataforma.
- 🔗 **Campo URL de imagem externa** — prioridade sobre upload local, com preview ao vivo, botões "Testar" e "Limpar", validação http/https.

### Corrigido
- Modal não fecha mais ao clicar fora (evita perda de preenchimento).
- Campos obrigatórios escondidos no modo edição não bloqueiam mais o submit.
- Select "Origem" estilizado no tema dark (antes aparecia azul nativo do macOS).
- Padding interno do modal de compra corrigido.
- Ordenação de compras no mesmo dia agora usa timestamp hora/minuto.

### Mudado
- 🎨 Tema refeito para **dark gamer preto + vermelho**.
- 🗂️ Produtos agora exibidos em **grade de cards** (substitui a tabela).
- 📁 Código organizado em `js/utils/` (format, calc, images) para facilitar manutenção.

---

## [1.2.0]

### Adicionado
- Importação de planilha Excel (.xlsx) usando SheetJS empacotada localmente.
- Leitura inteligente de múltiplos nomes de colunas (Produto, Custo Total, Taxa Shopee, etc).
- Conversão automática de taxa em formato decimal (0.3216 → 32.16%).
- Divisão de custo total pelo número de unidades para obter custo unitário.

---

## [1.1.0]

### Adicionado
- Filtros (apenas lucrativos, prejuízo, alto lucro >50%).
- Ordenação (mais recentes, maior lucro, maior margem, nome).
- Destaque visual para os 3 produtos mais lucrativos.
- Dashboard com resumo (total investido, lucro, margem média, quantidade).
- Top 5 mais lucrativos no dashboard.

---

## [1.0.0]

### Adicionado
- Cadastro básico de produtos (nome, custo, preço, quantidade, taxa, link, foto).
- Cálculos automáticos de valor líquido, lucro por unidade, lucro total e margem.
- Upload de foto via base64.
- Persistência em localStorage.
- Interface dashboard com cards.
- Tabela de produtos com editar/excluir.
