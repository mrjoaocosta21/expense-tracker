# Perfil de design — Expense Tracker web

- **Categoria:** Decisão de projeto.
- **Estado:** Proposta do implementador; direção visual pendente de validação do usuário.
- **Escopo:** Aplicação pessoal web com armazenamento no navegador.
- **Revisão:** 2026-11-26.

## Objetivo

Permitir que a pessoa registre receitas e despesas, entenda seu saldo e acompanhe os limites de gastos. A informação principal é o resultado do período selecionado; a ação principal é adicionar um lançamento.

## Quando aplicar

Usar este perfil ao implementar ou revisar a versão web. Ele adapta o [modelo de perfil](../../design/modelo-perfil-de-design.md) e o [checklist de UI](../../design/checklist-ui.md) ao contexto deste projeto. As escolhas abaixo são propostas para esta aplicação, sem aprovação visual implícita pelo uso do guia.

## Orientações

### Contexto e escopo

| Campo | Definição |
| --- | --- |
| Projeto | Expense Tracker — versão web. |
| Responsável pelo projeto | Usuário do repositório; identificação pública não definida. |
| Contexto | Pessoal; identidade institucional TCE não se aplica. |
| Público | Pessoa que deseja controlar suas finanças em um navegador, inclusive no celular. |
| Necessidades de acesso | Interface em português, operação por teclado, leitura com tecnologia assistiva e adaptação a telas estreitas. |
| Tarefa principal | Registrar um lançamento e verificar seu efeito nos totais e no orçamento. |
| Tecnologia autorizada | HTML, CSS e JavaScript, com armazenamento local; escolha expressa do usuário em 2026-11-26. |
| Dependências | Sem framework, biblioteca de gráficos, fonte remota ou etapa de compilação. |
| Persistência | Dados do navegador e origem utilizados; exportação/importação JSON para backup e transferência manual. |
| Execução | Abrir `versao-web/index.html` ou servir a pasta por HTTP local. |

A versão Python permanece como referência histórica. O arquivo executável `versao-python/expense_tracker.py` contém CRUD, total e resumo. A busca e o orçamento das melhorias 1 e 2 estão como código no [Markdown das melhorias](<../../versao-python/melhorias-1-e-2 /expense-tracker(melhorias 1 e 2).md>), e são referências para a nova interface.

### Fluxos desta entrega

- Visão geral por mês ou todos os períodos, com cartões de saldo, receitas e despesas.
- Cadastro, edição e exclusão confirmada de receitas e despesas, usando categorias fixas da aplicação.
- Consulta de lançamentos por busca, categoria, tipo e intervalo de datas.
- Distribuição de despesas por categoria em barras, acompanhada dos valores em texto.
- Definição e remoção de limites mensais gerais e por categoria, com aviso em 80% e alerta em 100%.
- Exportação JSON, restauração JSON com confirmação de substituição e exportação CSV.

### Direção visual proposta

| Função | Valor proposto | Intenção |
| --- | --- | --- |
| Ação principal e receitas | `#14644c` | Dar continuidade visual às ações e aos valores de entrada. |
| Fundo da aplicação | `#f5f7f9` | Separar os grupos de informação das superfícies de conteúdo. |
| Superfícies | `#ffffff` | Apoiar leitura de cartões, formulários e lançamentos. |
| Texto principal | `#182b29` | Títulos, valores e conteúdo essencial. |
| Texto secundário | `#526562` | Ajuda, contexto e metadados. |
| Despesas e ações destrutivas | `#a13939` | Diferenciar saídas e exclusão, sempre com rótulo textual. |
| Navegação lateral | `#102f29` | Identificar a navegação sem competir com os totais. |
| Tipografia | Família sans-serif do sistema | Evitar dependência de rede e respeitar as fontes disponíveis no dispositivo. |
| Valores financeiros | Algarismos tabulares | Facilitar comparação de valores alinhados. |

**Situação de aprovação:** o implementador propôs esses valores em 2026-11-26 para viabilizar uma primeira versão revisável. Aprovação do usuário, data e evidência: **[PENDENTE]**. Pares opacos principais tiveram contraste calculado; foco, bordas e estados na composição real continuam **[PENDENTES DE VERIFICAÇÃO EM NAVEGADOR]**.

### Hierarquia, componentes e responsividade

A leitura segue período selecionado, saldo/receitas/despesas, distribuição por categoria e lançamentos. Filtros ficam próximos da listagem que modificam. O contexto do orçamento é mensal e precisa permanecer explícito, inclusive quando a visão geral exibe todos os períodos.

Cartões, botões, campos, mensagens e diálogos devem compartilhar os estilos da aplicação. Receitas e despesas precisam de nomes e valores legíveis; verde e vermelho são sinais complementares. Gráficos mantêm categorias e valores disponíveis em texto.

Em **1440 CSS px**, conferir navegação lateral e distribuição dos painéis. Em **768 CSS px**, reorganizar grupos sem afastar filtros de seus resultados. Em **320 CSS px**, preservar leitura, campos e ações; verificar a listagem e os diálogos sem corte de conteúdo. Essas larguras são pontos de revisão, não garantia de suporte validado.

### Estados e casos pertinentes

| Estado ou caso | Comportamento esperado |
| --- | --- |
| Primeiro uso | Explicar a ausência de lançamentos e oferecer cadastro. |
| Consulta sem resultado | Informar que os filtros não encontraram lançamentos e permitir limpá-los. |
| Carregamento/importação | Informar andamento quando houver espera e evitar confirmação duplicada. Não inserir atraso artificial em operações locais imediatas. |
| Sucesso | Confirmar cadastro, edição, exclusão, orçamento e importação somente após persistência bem-sucedida. |
| Validação | Explicar entradas inválidas, preservar preenchimento e associar o erro ao campo pertinente. |
| Falha de persistência | Informar bloqueio ou falta de espaço no armazenamento, sem apresentar a operação como salva. |
| Dados locais inválidos | Explicar o problema; não sobrescrever silenciosamente os dados existentes. |
| Orçamento sem limite | Convidar a definir um limite, sem interpretar ausência como orçamento de zero. |
| Orçamento em atenção/excedido | Apresentar percentual, gasto, limite e significado em texto. |
| Exclusão ou restauração | Explicar o efeito e permitir cancelar antes de alterar os dados. |
| Texto longo e valores extremos | Manter conteúdo compreensível e ações alcançáveis, sem quebrar os cartões. |
| Sem conexão | Após abrir os arquivos locais, os fluxos não devem depender de serviços externos. |
| Sem permissão/sessão expirada | Autenticação não se aplica; bloqueio de armazenamento é tratado como erro de persistência. |

## Exemplos

Ao registrar uma despesa de R$ 80,00 com limite mensal de R$ 100,00, o orçamento deve indicar 80% consumido e um aviso textual. Se a despesa pertence a outro mês, o cálculo usa o mês da data do lançamento.

Ao restaurar um backup, a pessoa deve entender que os dados atuais serão substituídos. Cancelar a confirmação preserva os dados atuais; um arquivo inválido não deve iniciar a substituição.

## Critérios de verificação

- [ ] Registrar um lançamento e conferir sua persistência após recarregar.
- [ ] Diferenciar totais do período, resultado dos filtros e contexto mensal do orçamento.
- [ ] Executar o [roteiro manual](verificacao-manual.md), registrando ambiente e evidências.
- [ ] Medir contraste das combinações efetivamente utilizadas e revisar foco, teclado, rótulos e anúncios dinâmicos.
- [ ] Conferir 320, 768 e 1440 CSS px, ampliação de texto e conteúdo longo.
- [ ] Demonstrar primeiro uso, busca vazia, falha de gravação e restauração cancelada/inválida.
- [ ] Registrar aprovação visual com responsável, data e evidência antes de marcar a direção como aprovada.

A meta de revisão é considerar os critérios aplicáveis da WCAG 2.2 A e AA com base no checklist local. Este perfil e a implementação inicial não constituem declaração de conformidade integral.

## Referências

- [Padrões e decisões](../../design/padroes-e-decisoes.md): categorias, estados documentais e registro de aprovação.
- [Modelo de perfil](../../design/modelo-perfil-de-design.md): estrutura adaptada neste documento.
- [Checklist de UI](../../design/checklist-ui.md): método de verificação e referências de acessibilidade.
- [Princípios visuais](../../design/01-fundamentos/principios.md): hierarquia, proximidade e consistência.
- [Cores e estados](../../design/04-temas/cores-e-estados.md): papéis de cor e comportamento dos componentes.

## Pendências

- Validação da direção visual pelo usuário.
- Execução e registro dos cenários manuais, inclusive leitor de tela e dispositivos móveis.
- Medições dos estados reais e avaliação completa dos critérios de acessibilidade aplicáveis.
