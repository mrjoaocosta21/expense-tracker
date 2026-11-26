# Verificação manual — Expense Tracker web

- **Categoria:** Roteiro de verificação.
- **Estado:** Preparado; cenários abaixo não executados neste documento.
- **Escopo:** Fluxos, persistência, responsividade e acessibilidade da versão web.
- **Revisão:** 2026-11-26.

## Objetivo

Revisar a versão web com dados controlados, resultados esperados e evidências. Nenhum cenário está aprovado apenas por constar neste roteiro.

## Quando aplicar

Executar após alterações de comportamento ou antes de usar a versão com dados pessoais. Usar um perfil de navegador de teste e salvar um backup antes de simular erros, excluir dados ou restaurar arquivos.

## Orientações

### Preparação e registro

Abrir `versao-web/index.html` no navegador ou, a partir da raiz do repositório, executar:

```sh
python3 -m http.server 8000 --directory versao-web
```

Acessar `http://localhost:8000`. O servidor é apenas uma forma de entregar os arquivos; os lançamentos permanecem no navegador. O armazenamento de `file://` pode variar conforme o navegador. HTTP local oferece uma origem estável desde que protocolo, endereço e porta sejam mantidos. Trocar a origem não transfere os dados automaticamente.

Registrar para cada cenário: data, navegador/versão, sistema, origem (`file://` ou HTTP), largura/zoom, procedimento, resultado, evidência e próxima ação. Usar os resultados **atende**, **falha**, **não se aplica** com justificativa ou **não verificado**. Todos os cenários começam como **não verificado**; preencher o registro após executá-los.

Não apagar dados reais para realizar testes. Simulações de armazenamento corrompido, falta de espaço e concorrência devem ocorrer em perfil descartável.

### Dados controlados

Escolher um mês A e o mês anterior B. Usar categorias existentes nos seletores. Exemplo de base:

| Tipo | Período | Valor | Descrição |
| --- | --- | --- | --- |
| Receita | Mês A | R$ 1.000,00 | Receita de teste |
| Despesa | Mês A | R$ 80,00 | Mercado teste |
| Despesa | Mês A | R$ 20,00 | Transporte teste |
| Despesa | Mês B | R$ 50,00 | Despesa do mês anterior |

No mês A, esperar receitas de R$ 1.000,00, despesas de R$ 100,00 e saldo de R$ 900,00. Em todos os períodos, esperar despesas de R$ 150,00 e saldo de R$ 850,00. Estes são resultados esperados da base, não resultados já observados.

### Fluxos e cálculos

| ID | Procedimento | Resultado esperado |
| --- | --- | --- |
| F01 | Abrir em um perfil sem dados. | Primeiro uso com totais zerados, explicação e ação de cadastro; nenhum dado fictício confundido com lançamento real. |
| F02 | Criar a base controlada e alternar mês A, mês B e todos. | Cartões e distribuição refletem o período; o rótulo permite identificar o recorte. |
| F03 | Cadastrar receita e despesa com data, categoria e descrição. | Confirmação, atualização da listagem e totais; valores e sinais identificam o tipo. |
| F04 | Editar valor, descrição, tipo, categoria e mês de um lançamento. | Um único registro atualizado; grupos e totais afetados são recalculados. |
| F05 | Pedir exclusão e cancelar; depois confirmar. | Cancelar mantém tudo; confirmar remove apenas o lançamento escolhido. |
| F06 | Cadastrar vários lançamentos no mesmo dia; excluir um e cadastrar outro. | Identificadores distintos e ações vinculadas ao registro correto. |
| F07 | Buscar parte da descrição e variar maiúsculas/minúsculas. | Resultado coerente com a busca; texto digitado permanece disponível. |
| F08 | Combinar busca, categoria, tipo e intervalo de datas. | Todos os filtros se aplicam em conjunto; registros nas datas inicial/final são incluídos. |
| F09 | Informar intervalo com início posterior ao fim. | Explicação clara ou impedimento da combinação inválida, sem apresentar silenciosamente um resultado enganoso. |
| F10 | Aplicar um filtro sem resultados e depois limpar. | Mensagem distinta do primeiro uso; limpar recupera a listagem. |
| F11 | Comparar barras por categoria e valores textuais. | Somente despesas do período; soma igual ao total de despesas; ausência de despesas tratada como vazio. |
| F12 | Somar R$ 0,10 e R$ 0,20. | Total exibido de R$ 0,30; cálculos não acumulam resíduos de ponto flutuante. |
| F13 | Tentar valor zero, negativo, vazio, letras, centavos em excesso e valor muito alto. | Validação compreensível; nenhum lançamento inválido persistido. |
| F14 | Usar vírgula e ponto conforme as instruções do campo. | Entrada aceita ou rejeitada de modo consistente com o formato informado; nenhuma conversão silenciosa para valor diferente. |
| F15 | Conferir datas inválidas, ano bissexto e um lançamento perto da mudança de mês. | Datas reais preservadas, sem deslocamento por fuso horário; dia inválido recusado. |
| F16 | Usar descrição longa, acentos e texto como `<img src=x onerror=alert(1)>`. | Texto renderizado como conteúdo; sem execução de HTML e sem ocultar ações. |

### Orçamento

| ID | Procedimento | Resultado esperado |
| --- | --- | --- |
| O01 | Abrir sem limites e definir limite geral de R$ 100,00. | Ausência de limite é distinta de zero; novo limite persistido. |
| O02 | No mês de teste, variar despesas para R$ 79,99, R$ 80,00, R$ 99,99, R$ 100,00 e R$ 100,01. | Aviso a partir de 80%; alerta a partir de 100%; gasto e limite apresentados em texto. |
| O03 | Definir limite por categoria e lançar também em outra categoria. | Limite da categoria conta apenas suas despesas; geral inclui todas as despesas, sem receitas. |
| O04 | Criar ou editar despesa do mês B. | Alertas consideram o mês da data da despesa, sem somar gastos de meses diferentes. |
| O05 | Mudar valor/categoria/mês e depois excluir uma despesa. | Resumo do orçamento é recalculado; não mantém percentual antigo. |
| O06 | Remover limite geral e limite de categoria, cancelar quando houver confirmação. | Apenas o limite solicitado é removido; cancelar mantém a configuração. |
| O07 | Selecionar todos os períodos na visão geral. | O orçamento continua identificando explicitamente seu contexto mensal. |

Os limiares e o cálculo por mês vêm das [melhorias 1 e 2 no Markdown](<../../versao-python/melhorias-1-e-2 /expense-tracker(melhorias 1 e 2).md>); eles não estão incorporados ao arquivo Python executável original.

### Persistência, backup e recuperação

| ID | Procedimento | Resultado esperado |
| --- | --- | --- |
| P01 | Recarregar, fechar e reabrir na mesma origem e perfil. | Lançamentos e orçamentos persistem. |
| P02 | Abrir em outro navegador/perfil/origem. | Os dados não são compartilhados automaticamente; a interface informa o caráter local do armazenamento. |
| P03 | Exportar JSON, adicionar um lançamento e importar o backup; primeiro cancelar e depois confirmar. | Cancelar preserva tudo; confirmar substitui dados pelo backup, incluindo limites; o efeito é explicado antes da alteração. |
| P04 | Importar JSON truncado, arquivo incompatível, campos ausentes, datas inválidas, valores inválidos e IDs duplicados. | Erro acionável; dados anteriores permanecem intactos. |
| P05 | Importar backup sem lançamentos, mas com estrutura válida. | Restauração resulta em primeiro uso; não é confundida com erro de leitura. |
| P06 | Exportar CSV e abrir em editor/planilha. | Cabeçalho e valores coerentes; acentos, aspas, vírgulas e quebras de linha preservados; escopo exportado corresponde ao informado. |
| P07 | Exportar descrições iniciadas por `=`, `+`, `-` e `@`; abrir em planilha de teste. | Conteúdo textual não é interpretado como fórmula executável. |
| P08 | Bloquear armazenamento ou simular falha de escrita em ambiente descartável. | Erro explícito, sem mensagem falsa de sucesso; dados em uso não são substituídos por estado não salvo. |
| P09 | Corromper somente o registro da aplicação no armazenamento de teste e recarregar. | Erro distinto do primeiro uso; não sobrescrever silenciosamente o conteúdo inválido. |
| P10 | Abrir duas abas; salvar dados alternadamente. | Verificar atualização/conflito entre abas e registrar o comportamento observado; alterações não devem desaparecer sem aviso. |
| P11 | Abrir pelos arquivos locais e desligar a rede. | CRUD, consulta e exportação continuam disponíveis; nenhum recurso externo impede o uso. |

### Responsividade e acessibilidade

| ID | Procedimento | Resultado esperado |
| --- | --- | --- |
| A01 | Testar 320, 768 e 1440 CSS px, incluindo diálogos e descrições longas. | Conteúdo e ações legíveis; cartões e filtros se reorganizam; eventual rolagem da tabela não obriga a rolagem horizontal de toda a página. |
| A02 | Ampliar texto/zoom e conferir espaçamentos de texto conforme o checklist local. | Sem perda de conteúdo, botões ou mensagens. |
| A03 | Executar cadastro, filtros, orçamento, backup e cancelamento somente por teclado. | Ordem lógica, foco visível e ausência de bloqueio de navegação. |
| A04 | Abrir e fechar cada diálogo usando teclado e Escape. | Nome do diálogo disponível, foco dentro dele enquanto aberto e retorno ao acionador ao fechar. |
| A05 | Usar leitor de tela nos campos, tabela/lista, gráfico e mensagens. | Rótulos e relações compreensíveis, valores disponíveis em texto e mensagens pertinentes anunciadas. Registrar leitor/navegador usados. |
| A06 | Medir contraste de texto, foco, controles e informação gráfica nos fundos reais. | Resultados registrados por par e função conforme o checklist; transparências e estados considerados. |
| A07 | Conferir receitas, despesas, erro, sucesso e alerta sem depender das cores. | Rótulos/textos comunicam os significados. |
| A08 | Provocar erros e corrigir sem mouse. | Mensagem vinculada ao campo, orientação clara e preenchimento válido preservado. |
| A09 | Conferir nomes dos botões com ícone e alvos de toque no celular. | Função identificável por nome acessível; alvos e espaçamento avaliados conforme o checklist. |
| A10 | Preferir movimento reduzido no sistema e repetir os fluxos. | Animações não impedem a compreensão nem atrasam a interação. |

Essa lista é um recorte de revisão. Aprovar os cenários não substitui a avaliação de todos os critérios WCAG aplicáveis nem comprova conformidade integral.

## Exemplos

### Verificações técnicas executadas em 2026-11-26

- Suíte automatizada: **42 testes passaram**, sendo 9 de domínio, 17 de armazenamento/backup e 16 de integração em DOM simulado. Inclui cadastro, edição, exclusão confirmada, filtros, limites, cancelamento/restauração de backup, recuperação de conteúdo corrompido, falhas de gravação e alteração em outra aba.
- Sintaxe dos três arquivos JavaScript validada pelo Node.js.
- HTML analisado: 302 elementos com aninhamento e fechamentos conferidos, 87 identificadores únicos, sem referências de rótulos ou ARIA ausentes; arquivos referenciados e identificadores usados pelo controlador presentes.
- Servidor estático local: HTML, CSS, favicon e os três scripts responderam HTTP 200 com os tipos de conteúdo esperados.
- Revisão estática corrigiu a ocultação de datas em telas intermediárias, antecipou a reorganização dos filtros e adicionou foco claro na navegação lateral. Isso não equivale à inspeção visual dessas larguras.

Contrastes calculados por luminância relativa sRGB em pares opacos do CSS:

| Função e par | Razão aproximada |
| --- | --- |
| Texto principal `#182b29` / branco | 14,83:1 |
| Texto secundário `#526562` / branco | 6,18:1 |
| Texto secundário / fundo `#f5f7f9` | 5,76:1 |
| Branco / ação `#14644c` | 7,10:1 |
| Branco / exclusão `#a13939` | 6,65:1 |
| Erro `#a13939` / `#fbeeee` | 5,88:1 |
| Aviso `#805100` / `#fff5df` | 6,26:1 |
| Borda `#7c8c87` / branco | 3,53:1 |
| Foco `#195fc3` / branco | 6,06:1 |
| Foco da navegação `#d0eedb` / lateral `#102f29` | 11,59:1 |
| Foco da navegação / item ativo `#295143` | 7,20:1 |

Não foi possível abrir um navegador utilizável no ambiente. Os cenários manuais abaixo, a aparência final, a navegação por teclado e os anúncios por leitor de tela continuam não verificados. Os cálculos de contraste não comprovam conformidade integral.

### Modelo para registrar verificações manuais

| Data/ambiente | Cenário | Resultado | Evidência | Próxima ação |
| --- | --- | --- | --- | --- |
| [PREENCHER] | P03 — restauração cancelada | Não verificado | [PREENCHER após executar] | Executar em perfil de teste. |
| [PREENCHER] | A04 — foco no diálogo | Não verificado | [PREENCHER após executar] | Conferir com teclado e leitor de tela. |

Os registros acima são modelos de preenchimento, sem execução atribuída.

## Critérios de verificação

- [ ] Ambiente, origem e conjunto de dados registrados.
- [ ] Resultados observados separados dos resultados esperados.
- [ ] Falhas acompanhadas de reprodução e evidência, sem dados pessoais.
- [ ] Cenários não executados permanecem como não verificados.
- [ ] Limitações de navegador, armazenamento e tecnologias assistivas registradas.
- [ ] Revisão visual confrontada com o [perfil do projeto](perfil-de-design.md).

## Referências

- [Perfil de design](perfil-de-design.md): objetivo, proposta visual e estados do produto.
- [Checklist de UI](../../design/checklist-ui.md): revisão de usabilidade, acessibilidade, métodos e evidências.
- [Cores e estados](../../design/04-temas/cores-e-estados.md): contraste e mensagens.
- [Padrões e decisões](../../design/padroes-e-decisoes.md): estados documentais e limites de aprovação.

## Pendências

Executar os cenários nas plataformas disponíveis e registrar resultados reais. A existência deste roteiro não indica aprovação funcional, visual ou de acessibilidade.
