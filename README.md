# Expense Tracker

Aplicação de finanças pessoais com uma versão web em **HTML, CSS e JavaScript**, usando **localStorage**. A versão Python foi preservada em `versao-python/`.

## Executar a versão web

Abra [versao-web/index.html](versao-web/index.html) no navegador. Não há dependências nem compilação.

Para usar uma origem local estável, execute na raiz do projeto:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory versao-web
```

Acesse **http://localhost:8000**. Mantenha o mesmo endereço, porta e perfil do navegador para acessar os mesmos dados.

## Recursos

- Cadastro, edição e exclusão confirmada de receitas e despesas.
- Saldo, receitas, despesas e distribuição por categoria, por mês ou em todos os períodos.
- Busca por descrição, filtros por tipo, categoria e intervalo de datas, com paginação.
- Orçamento mensal total e por categoria, com avisos em 80% e 100%.
- Backup JSON com restauração validada e confirmação de substituição.
- Exportação CSV dos lançamentos filtrados.

Os dados ficam no navegador, sem sincronização automática entre dispositivos. Limpar os dados do site ou usar outro navegador/origem altera o acesso aos registros. Exporte backups regularmente. A persistência em `file://` depende do navegador; prefira HTTP local para uso contínuo.

Consulte [a documentação da versão web](versao-web/README.md) para arquitetura, testes, limites e recuperação. O [perfil de design](versao-web/docs/perfil-de-design.md) registra a proposta visual com base no guia local.

## Referências e ideias anteriores

Os apontamentos abaixo foram preservados como histórico. As menções a React, Node.js e bancos de dados não representam a implementação atual.

### Expense Tracker & Budget Manager
    Real world use case: Personal finance management
        - Income and expense tracking
        - Monthly budget creation
        - Category-wise analytics
        - Interactive finantial charts
        - Downloadable reports

* Tech Stack: React, Node.js, PostgreSQL, Chart.js

------------------------------------------------------------------------------------------------------

# Personal Finace Tracker
     A practical React application that demonstrate data management, filtering, dashboards, forms, and real user workflows.
     Build a dashboard where users record income and expenses, organize transactions, and track monthly spending.

        * WHAT YOU'LL BUILD
            - Income and expense forms
            - Transaction history
            - Category filters
            - Monthly budget dashboard

        * SKILLS YOU'LL SHOW
            - Form handling
            - Derived state and calculations
            - Charts and data vizualization
            - Local storage or database sync

        * PORTIFOLIO VALUE
            Shows that you can turn complex financial data into a clear, useful, adn polished interface.

------------------------------------------------------------------------------------------------------
Expense tracker 
https://github.com/machadop1407/Expense-Tracker-Fullstack

------------------------------------------------------------------------------------------------------

# Expense Tracker

    - Features : Add income & expenses, Monthly Analytics
    - Stack: React + Express + MongoDB
    - Time: 4-5 days

------------------------------------------------------------------------------------------------------

# Expense Tracker
    Track income, expenses, balance, and transaction history using JavaScript.

        * WHAT YOU'LL BUILD
        - Add income transactions
        - Add expense transactions
        - Calculate total balance
        - Store history locally

Array methods, form handling, localStorage, Balance logic

cont balance = income - expenses;
localStorage.setItem("transactions", JSON.stringfy(data));

------------------------------------------------------------------------------------------------------

# Expense Tracker
    Build a simple app to track income, expenses, balance, and transaction history.

        * What you build
            A budget tracker that shows total balance, income, expenses, and recent transactions.

        * Core Features
           Add transaction, choose income or expense, calculate balance, and delete entries.

        * You Practice
            Arrays, objects, form handling, calculations, DOM updates, and LocalStorage

        * Time & Level
            Beginner-friendly project. Finish 3-5 hours
                        
------------------------------------------------------------------------------------------------------

# Expense Tracker Python

* OVERVIEW
* FEATURES
* SKILLS USED
* TECHNOLOGIES
* HOW IT WORKS
* RUN THE PROJECT
* DATA STORAGE
* POSSIBLE IMPROVEMENTS
