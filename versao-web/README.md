# Expense Tracker — versão web

Controle pessoal de receitas, despesas e orçamentos em HTML, CSS e JavaScript. Funciona sem framework, fontes externas, biblioteca de gráficos ou etapa de compilação. A versão Python original permanece intacta.

## Executar

Abra `index.html` no navegador ou, na raiz do repositório, execute:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory versao-web
```

Acesse **http://localhost:8000**. O servidor entrega somente os arquivos estáticos; não recebe nem armazena seus lançamentos. É possível hospedar esta pasta em um servidor estático.

Use a mesma origem — protocolo, endereço e porta — e o mesmo perfil do navegador para acessar os registros. `localhost` e `127.0.0.1` são origens diferentes. Em `file://`, a disponibilidade e o isolamento de localStorage variam entre navegadores; use HTTP local para uma origem previsível. Nenhum dado existente da versão Python é importado automaticamente.

## Usar

1. Escolha o período e clique em **Novo lançamento**.
2. Selecione receita ou despesa, informe descrição, valor, data e categoria.
3. Confira os totais e a distribuição de despesas. O saldo corresponde a receitas menos despesas do período selecionado; não é um saldo bancário acumulado quando há filtro mensal.
4. Em **Seu orçamento**, defina limites do mês. Campos em branco removem os respectivos limites; limites por categoria são independentes do limite geral.
5. Em **Seus dados**, baixe um backup JSON regularmente e antes de trocar de navegador/dispositivo ou limpar os dados do site.

Ao salvar um lançamento, a visão passa para o mês da data informada e os filtros da lista são limpos para mostrar o resultado. Busca, tipo, categoria e datas filtram somente o histórico; os cartões, o gráfico e o orçamento mantêm o contexto do período no topo. A busca ignora diferenças de acentos e maiúsculas. As datas inicial e final são inclusivas.

Valores aceitam formatos como `150,50`, `1.234,56`, `1234.56` e `150`. Um ponto seguido de três dígitos indica separador de milhar: `1.234` corresponde a R$ 1.234,00. Use vírgula para deixar os centavos explícitos. Zero, valores negativos e frações menores que um centavo são recusados.

## Dados, backup e recuperação

- A chave `expense-tracker:v1` guarda lançamentos e orçamentos em localStorage. Não há conta, backend ou sincronização automática.
- O JSON de backup inclui todos os registros e limites. Restaurá-lo **substitui todos os dados atuais**, somente após validação e confirmação. O arquivo contém informações financeiras: guarde-o com cuidado.
- O CSV inclui todos os resultados dos filtros atuais, incluindo as páginas que não estão visíveis. Usa UTF-8 com BOM, separador `;`, decimal com vírgula e uma coluna de tipo; ambos os tipos têm valor positivo nessa exportação.
- Se houver falha de gravação ou falta de espaço, os dados anteriores e os campos preenchidos são preservados, sem confirmação falsa de sucesso.
- Se o registro salvo estiver corrompido ou usar versão desconhecida, as gravações ficam bloqueadas. **Baixar recuperação** exporta o conteúdo original para análise. Não apague esse registro antes de guardar a recuperação e seus backups. Após corrigir o armazenamento em um ambiente de teste, recarregue a aplicação.
- Alterações em outra aba geram um aviso para recarregar; antes de gravar, o repositório também compara o conteúdo salvo com a versão carregada. Essa proteção reduz sobrescritas acidentais. localStorage não oferece transações entre abas: evite edições simultâneas.

Dados de outros formatos, inclusive o JSON da versão Python, não são backups compatíveis desta versão. A importação aceita apenas o formato exportado pela própria aplicação, até **20 MiB**, com identificadores únicos e campos válidos. Antes de salvar, a aplicação também verifica se o estado cabe em um backup restaurável; a capacidade disponível no navegador pode ser menor.

## Estrutura e decisões

```text
versao-web/
├── index.html               # Estrutura semântica e diálogos
├── assets/favicon.svg       # Ícone local
├── css/styles.css           # Tokens, componentes e regras responsivas
├── js/
│   ├── domain.js            # Validação, filtros, totais e regras de orçamento
│   ├── storage.js           # Persistência, backup e exportação CSV
│   └── app.js               # Estado da tela, renderização e eventos
├── docs/                    # Perfil visual e roteiro de verificação
└── tests/                   # Testes com o runner nativo do Node.js
```

As regras de domínio não dependem da interface nem do armazenamento. O repositório recebe o provedor de armazenamento por injeção, permitindo testar falhas e concorrência. A interface coordena essas duas partes e deriva os indicadores dos lançamentos, sem persistir totais redundantes. Scripts clássicos com escopo isolado permitem abrir o HTML diretamente, sem os requisitos de origem dos módulos ES.

O dinheiro é armazenado em centavos inteiros. Há limite de **10.000 lançamentos**, descrição de **1 a 120 caracteres** e **R$ 1 bilhão por lançamento/limite**. As categorias são fixas nesta primeira versão. Descrições são inseridas como texto no DOM e as células CSV recebem escape e proteção contra interpretação como fórmula.

A proposta visual e as referências do guia estão no [perfil de design](docs/perfil-de-design.md). O [roteiro manual](docs/verificacao-manual.md) cobre teclado, leitor de tela, responsividade, falhas de armazenamento e recuperação. Esses documentos distinguem verificação técnica de aprovação visual.

## Verificar

Com Node.js instalado, execute na raiz do repositório:

```sh
node --test versao-web/tests/*.test.cjs
node --check versao-web/js/app.js
node --check versao-web/js/domain.js
node --check versao-web/js/storage.js
```

O Node.js é necessário apenas para os testes, não para executar o aplicativo. Testes de domínio e repositório cobrem dinheiro, datas, filtros, limites, backups inválidos, conteúdo corrompido, falhas de escrita e conflitos entre instâncias. Os testes de integração com DOM simulado verificam fluxos de eventos e persistência; não substituem testes em navegador.

A inspeção visual, o teclado e o leitor de tela precisam ser verificados em navegador real. O ambiente de implementação não disponibilizou um navegador utilizável. Não há declaração de conformidade WCAG integral.
