/* ============================================
   description-generator.js — Gerador local de descrições comerciais

   Dado o nome de um produto (e opcionalmente seu tipo), devolve uma
   descrição comercial pronta para marketplace, sem emojis, com tom
   profissional e natural.

   Arquitetura em 2 camadas:
   1) Detecção de categoria via palavras-chave no nome
   2) Templates por categoria com variações aleatórias para não ficar robótico

   Extensível: para trocar pela IA no futuro, basta substituir
   generateDescription() por uma chamada HTTP.

   Sem dependências de DOM.
   ============================================ */

// ==========================================================
// Catálogo de categorias e palavras-chave
// ==========================================================
const CATEGORIES = [
  {
    id: "decorativo",
    keywords: [
      "vaso", "cachepo", "cachepô", "planta", "jardim", "ornamento",
      "decoração", "decor", "escultura", "quadro", "mandala", "luminária",
      "abajur", "enfeite",
    ],
  },
  {
    id: "suporte_funcional",
    keywords: [
      "suporte", "apoio", "holder", "base", "gancho", "prateleira",
      "stand", "cavalete",
    ],
  },
  {
    id: "organizacao",
    keywords: [
      "organizador", "porta", "caixa", "divisor", "bandeja", "recipiente",
      "armazenamento", "separador", "compartimento",
    ],
  },
  {
    id: "acessorio_gamer",
    keywords: [
      "mouse", "headset", "teclado", "keyboard", "gamer", "controle",
      "joystick", "mousepad", "grip", "gameplay", "console",
    ],
  },
  {
    id: "tecnico_switch",
    keywords: [
      "switch", "micro switch", "microswitch", "encoder", "chave",
      "botão", "conector", "cabo", "adaptador", "resistor", "capacitor",
    ],
  },
  {
    id: "chaveiro",
    keywords: ["chaveiro", "pingente", "tag", "pendurico", "charm"],
  },
  {
    id: "miniatura",
    keywords: [
      "miniatura", "figura", "boneco", "action figure", "escultura",
      "estátua", "colecionável", "collectible", "maquete", "modelo",
    ],
  },
  {
    id: "cozinha",
    keywords: [
      "cozinha", "utensílio", "utensilio", "copo", "caneca", "prato",
      "tábua", "tabua", "porta-guardanapo", "descanso",
    ],
  },
  {
    id: "ferramenta",
    keywords: [
      "ferramenta", "chave fenda", "chave phillips", "alicate",
      "gabarito", "régua", "medidor", "escala",
    ],
  },
  {
    id: "brinde",
    keywords: [
      "brinde", "lembrança", "lembrancinha", "personalizado",
      "presente", "gift",
    ],
  },
];

// ==========================================================
// Templates por categoria
// ==========================================================
// Cada template tem 5 blocos: opening, benefit, usage, finish, closing.
// Cada bloco tem 2-3 variações para que a descrição não fique repetitiva
// quando gerada várias vezes para produtos parecidos.
const TEMPLATES = {
  decorativo: {
    opening: [
      "Adicione mais charme e personalidade ao seu ambiente com este {name}",
      "Transforme qualquer espaço em um ambiente mais acolhedor com este {name}",
      "Deixe a sua decoração ainda mais marcante com este {name}",
    ],
    benefit: [
      "ideal para compor espaços internos com um toque moderno e elegante",
      "perfeito para quem gosta de detalhes sofisticados no dia a dia",
      "combinação certa de estilo e simplicidade em um único produto",
    ],
    usage: [
      "Pode ser usado em salas, quartos, escritórios, varandas ou mesas de apoio",
      "Indicado para decorar ambientes residenciais e comerciais com personalidade",
      "Uma ótima opção para quem quer renovar um cantinho da casa sem reformar",
    ],
    finish: [
      "Produzido com bom acabamento e visual diferenciado",
      "Possui acabamento caprichado e design pensado para valorizar a peça",
      "Feito com atenção aos detalhes e resistência pensada para o uso diário",
    ],
    closing: [
      "Uma ótima escolha para quem busca praticidade e estilo na decoração",
      "Ideal para presentear ou complementar a sua própria casa",
      "Uma peça versátil que se encaixa em diversos estilos de ambiente",
    ],
  },

  suporte_funcional: {
    opening: [
      "Organize melhor o seu espaço com este {name}",
      "Mantenha tudo no lugar com praticidade usando este {name}",
      "Ganhe mais ordem e funcionalidade no seu dia a dia com este {name}",
    ],
    benefit: [
      "desenvolvido para oferecer apoio seguro e discreto",
      "solução prática para quem quer liberar espaço sem abrir mão da organização",
      "garante estabilidade e acesso rápido ao que você mais usa",
    ],
    usage: [
      "Perfeito para mesa de trabalho, escritório, setup gamer ou home office",
      "Pode ser utilizado em bancadas, estantes ou paredes conforme a necessidade",
      "Ideal para manter cabos, dispositivos e acessórios sempre organizados",
    ],
    finish: [
      "Feito com material resistente e acabamento limpo",
      "Construção firme pensada para uso prolongado",
      "Design discreto que combina com diferentes ambientes",
    ],
    closing: [
      "Uma escolha inteligente para quem valoriza praticidade e organização",
      "Transforma qualquer espaço em um ambiente mais funcional",
      "Produto simples que faz diferença no seu dia a dia",
    ],
  },

  organizacao: {
    opening: [
      "Mantenha tudo em ordem com este {name}",
      "Organize seus objetos de forma prática com este {name}",
      "Diga adeus à bagunça com este {name}",
    ],
    benefit: [
      "pensado para aproveitar ao máximo o espaço disponível",
      "oferece compartimentos bem distribuídos para facilitar o acesso",
      "solução simples para quem quer mais ordem sem ocupar muito lugar",
    ],
    usage: [
      "Perfeito para gavetas, estantes, escrivaninhas ou cômodas",
      "Pode ser usado em escritório, quarto, cozinha ou oficina",
      "Indicado para manter acessórios, ferramentas ou utensílios sempre à mão",
    ],
    finish: [
      "Construção robusta com acabamento limpo",
      "Feito com material resistente e atenção aos detalhes",
      "Design funcional que valoriza a utilidade da peça",
    ],
    closing: [
      "Uma forma simples de trazer mais praticidade para sua rotina",
      "Ideal para quem valoriza ambientes organizados e sem desperdício de espaço",
      "Um produto que combina utilidade e bom gosto",
    ],
  },

  acessorio_gamer: {
    opening: [
      "Leve seu setup para o próximo nível com este {name}",
      "Complemente sua estação gamer com este {name}",
      "Ganhe mais estilo e performance no seu setup com este {name}",
    ],
    benefit: [
      "pensado para oferecer mais conforto e praticidade nas suas sessões",
      "combina design e funcionalidade para quem leva o jogo a sério",
      "um detalhe que faz diferença no dia a dia de qualquer jogador",
    ],
    usage: [
      "Perfeito para mesa de jogo, home office ou setup profissional",
      "Indicado para jogadores casuais e competitivos",
      "Compatível com a maioria dos setups e periféricos do mercado",
    ],
    finish: [
      "Construção resistente e acabamento de qualidade",
      "Detalhes pensados para durabilidade e bom visual",
      "Feito com atenção aos detalhes que fazem diferença no uso real",
    ],
    closing: [
      "Uma adição certeira para quem quer melhorar a experiência gamer",
      "Ideal para quem valoriza um setup bem montado e funcional",
      "Combine funcionalidade e estilo no seu espaço de jogo",
    ],
  },

  tecnico_switch: {
    opening: [
      "Componente de alta qualidade, o {name} é indicado para quem busca desempenho e confiabilidade",
      "O {name} é a peça certa para projetos, manutenção ou customização",
      "Atenda às suas necessidades técnicas com este {name}",
    ],
    benefit: [
      "garante acionamento preciso e resposta consistente",
      "oferece durabilidade pensada para uso contínuo",
      "atende aplicações profissionais e projetos personalizados",
    ],
    usage: [
      "Perfeito para customização de mouses, teclados, controles e projetos DIY",
      "Indicado para manutenção, reparo ou montagem de equipamentos",
      "Compatível com a maioria dos projetos de eletrônica e customização",
    ],
    finish: [
      "Produto novo, embalado e pronto para uso",
      "Fabricação com padrão técnico voltado para aplicação real",
      "Construção que preza pela estabilidade de funcionamento",
    ],
    closing: [
      "Uma escolha confiável para quem entende do que precisa",
      "Ideal tanto para uso profissional quanto para entusiastas",
      "Componente essencial para quem quer resultado consistente",
    ],
  },

  chaveiro: {
    opening: [
      "Dê um toque especial ao seu molho de chaves com este {name}",
      "Um acessório charmoso para o dia a dia: {name}",
      "Personalize as suas chaves com este {name}",
    ],
    benefit: [
      "acessório discreto e elegante que combina com diversos estilos",
      "uma forma simples de deixar tudo mais identificável e com personalidade",
      "pequeno detalhe que faz diferença no visual e na praticidade",
    ],
    usage: [
      "Pode ser usado em chaves de casa, carro, escritório ou como enfeite em bolsas e mochilas",
      "Perfeito para presentear amigos, família ou para uso próprio",
      "Indicado também como lembrancinha ou brinde personalizado",
    ],
    finish: [
      "Acabamento caprichado e pronto para uso",
      "Feito com material resistente para o dia a dia",
      "Detalhes bem definidos e boa durabilidade",
    ],
    closing: [
      "Uma peça pequena com grande valor sentimental",
      "Ideal para quem gosta de acessórios com personalidade",
      "Um presente simples, prático e que sempre agrada",
    ],
  },

  miniatura: {
    opening: [
      "Amplie a sua coleção com este {name}",
      "Uma peça especial para colecionadores: {name}",
      "Tenha este {name} em destaque na sua prateleira",
    ],
    benefit: [
      "fabricado com riqueza de detalhes e proporções cuidadosas",
      "ótima opção para montar coleções temáticas e cenários",
      "peça que valoriza qualquer ambiente dedicado a colecionismo",
    ],
    usage: [
      "Ideal para exposição em estantes, nichos, bancadas ou dioramas",
      "Perfeito para ambientes temáticos, escritórios ou quartos decorados",
      "Indicado para presentes a fãs, colecionadores ou entusiastas",
    ],
    finish: [
      "Acabamento caprichado pensado para exibição",
      "Detalhes bem definidos e estrutura resistente",
      "Construção feita com atenção aos detalhes visuais",
    ],
    closing: [
      "Uma adição de destaque para qualquer coleção",
      "Presente certeiro para quem aprecia miniaturas e arte",
      "Peça que une estética e valor sentimental",
    ],
  },

  cozinha: {
    opening: [
      "Torne a sua cozinha mais prática e charmosa com este {name}",
      "Um item útil e bonito para o dia a dia: {name}",
      "Ganhe mais praticidade nas refeições com este {name}",
    ],
    benefit: [
      "combina funcionalidade e bom visual em um produto só",
      "pensado para facilitar tarefas do dia a dia",
      "uma peça útil que ainda compõe a decoração",
    ],
    usage: [
      "Ideal para uso doméstico em casas, apartamentos e cozinhas profissionais",
      "Perfeito para refeições, preparos e decoração de mesa",
      "Pode ser usado no dia a dia ou em ocasiões especiais",
    ],
    finish: [
      "Acabamento cuidadoso e fácil de limpar",
      "Construção resistente para aguentar o uso frequente",
      "Design pensado para durabilidade e estética",
    ],
    closing: [
      "Um item simples que faz diferença na rotina",
      "Ótima escolha para quem gosta de cozinhar com praticidade",
      "Combine funcionalidade e bom gosto na sua cozinha",
    ],
  },

  ferramenta: {
    opening: [
      "Ganhe mais precisão no seu trabalho com este {name}",
      "Facilite suas tarefas com este {name}",
      "Uma ferramenta útil para o dia a dia: {name}",
    ],
    benefit: [
      "pensado para oferecer ergonomia e bom desempenho",
      "ajuda a economizar tempo em tarefas recorrentes",
      "solução prática para manutenção, reparos e projetos pessoais",
    ],
    usage: [
      "Perfeito para uso doméstico, oficinas ou projetos DIY",
      "Indicado para profissionais e entusiastas que valorizam boa ferramenta",
      "Útil em várias situações do cotidiano",
    ],
    finish: [
      "Construção robusta e pronta para uso imediato",
      "Feito para aguentar o uso contínuo sem perder a funcionalidade",
      "Acabamento caprichado que faz diferença no manuseio",
    ],
    closing: [
      "Uma adição útil para sua caixa de ferramentas",
      "Investimento certo para quem preza por organização e eficiência",
      "Produto que oferece bom custo-benefício no longo prazo",
    ],
  },

  brinde: {
    opening: [
      "Presenteie com um toque especial usando este {name}",
      "Um presente simples e significativo: {name}",
      "Deixe qualquer ocasião mais memorável com este {name}",
    ],
    benefit: [
      "pensado para agradar e ser lembrado",
      "combina simplicidade e carinho em um único item",
      "opção versátil que se adapta a várias ocasiões",
    ],
    usage: [
      "Perfeito para aniversários, datas comemorativas ou lembranças de eventos",
      "Indicado para amigos, familiares ou clientes",
      "Pode ser personalizado conforme a ocasião",
    ],
    finish: [
      "Acabamento caprichado e pronto para entregar",
      "Detalhes bem cuidados para marcar presença",
      "Feito com atenção aos detalhes que fazem a diferença",
    ],
    closing: [
      "Um gesto simples que sempre faz bem",
      "Presente certo para quem quer lembrar alguém especial",
      "Ideal para criar memórias com pequenos detalhes",
    ],
  },

  // Fallback genérico — usado quando nenhuma categoria bate
  default: {
    opening: [
      "Conheça este {name}, uma ótima opção para quem busca qualidade e praticidade",
      "Apresentamos o {name}, produto pensado para atender diferentes necessidades",
      "O {name} é a escolha certa para quem valoriza bom custo-benefício",
    ],
    benefit: [
      "combina funcionalidade e bom acabamento em um único produto",
      "oferece a praticidade que o seu dia a dia precisa",
      "uma solução versátil e acessível para diversas situações",
    ],
    usage: [
      "Indicado para uso doméstico, profissional ou como presente",
      "Perfeito para quem quer praticidade sem abrir mão do visual",
      "Uma opção que se adapta a diferentes rotinas e espaços",
    ],
    finish: [
      "Produzido com bom acabamento e atenção aos detalhes",
      "Construção resistente pensada para uso prolongado",
      "Material de qualidade e visual caprichado",
    ],
    closing: [
      "Uma escolha certeira para quem busca um produto prático e bonito",
      "Ideal para quem valoriza bom custo-benefício",
      "Um produto simples, útil e bem feito",
    ],
  },
};

// Frases extras específicas para produtos fabricados em impressão 3D
const PRINT_3D_ADDITIONS = [
  "Peça fabricada em impressão 3D com qualidade controlada, permitindo personalização de cores conforme a disponibilidade do momento.",
  "Produto feito sob demanda em impressão 3D, o que garante atenção individual a cada peça produzida.",
  "Fabricado em impressão 3D com filamentos de boa qualidade, com opção de personalização e variação de cores.",
];

// ==========================================================
// Detecção de categoria
// ==========================================================
/** Normaliza texto para comparação (minúsculo, sem acentos). */
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Descobre a categoria mais provável com base no nome.
 * Usa match por PALAVRA INTEIRA para não confundir "chave" (switch)
 * com "chaveiro" ou "switch" com "chaveiro".
 */
function detectCategory(name) {
  const n = normalize(name);
  if (!n) return "default";
  // Adiciona espaços nas bordas para permitir match de palavra inteira
  const padded = ` ${n} `;
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      const k = normalize(kw);
      // Match exato de palavra: precisa ter espaço (ou borda) dos dois lados
      if (padded.includes(` ${k} `)) return cat.id;
    }
  }
  return "default";
}

/** Pega um item aleatório de um array. */
function pickRandom(arr) {
  if (!arr || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

// ==========================================================
// Geração principal
// ==========================================================
/**
 * Gera uma descrição comercial para o produto.
 *
 * @param {string} name — nome do produto
 * @param {object} opts
 * @param {"resale"|"3d_print"} opts.type — tipo do produto
 * @param {string} opts.material — material (opcional)
 * @returns {string} descrição pronta para colar no textarea
 */
function generateDescription(name, opts = {}) {
  const type = opts.type || "resale";
  const cleanName = String(name || "").trim();
  if (!cleanName) return "";

  const catId = detectCategory(cleanName);
  const tpl = TEMPLATES[catId] || TEMPLATES.default;

  // Monta a descrição em 2 parágrafos
  const opening = pickRandom(tpl.opening).replace(/{name}/g, cleanName);
  const benefit = pickRandom(tpl.benefit);
  const usage = pickRandom(tpl.usage);
  const finish = pickRandom(tpl.finish);
  const closing = pickRandom(tpl.closing);

  // Constrói o texto com pontuação correta
  const paragraph1 = `${opening}, ${benefit}. ${usage}.`;
  let paragraph2 = `${finish}. ${closing}.`;

  // Para produtos 3D, acrescenta uma frase técnica
  if (type === "3d_print") {
    paragraph2 += " " + pickRandom(PRINT_3D_ADDITIONS);
  }

  return `${paragraph1}\n\n${paragraph2}`;
}

/**
 * Gera apenas uma "frase de melhoria" — útil para complementar uma
 * descrição existente sem substituí-la. Pega fragmentos do template
 * adequado e monta 1 parágrafo curto.
 */
function generateImprovement(name, opts = {}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) return "";
  const catId = detectCategory(cleanName);
  const tpl = TEMPLATES[catId] || TEMPLATES.default;
  const finish = pickRandom(tpl.finish);
  const closing = pickRandom(tpl.closing);
  let text = `${finish}. ${closing}.`;
  if (opts.type === "3d_print") {
    text += " " + pickRandom(PRINT_3D_ADDITIONS);
  }
  return text;
}
