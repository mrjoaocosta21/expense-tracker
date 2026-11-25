1. Busca e filtro (primeira escolha). Mais lista de despesas tende a significar mais dificuldade de achar uma específica. A busca por categoria, intervalo de datas ou texto da descrição não exige biblioteca nova e reaproveita o que já existe (read_expenses, datetime). Ela também é a base para as outras melhorias: o orçamento mensal e os gráficos precisam filtrar por mês e categoria.

2. Orçamento e alerta. É a melhoria que mais faz o projeto parecer um controle de gastos de verdade, e não só um registro. Você define um limite mensal (geral ou por categoria), guardado em um segundo arquivo pequeno, e a cada nova despesa o programa avisa quando passa de 80% ou de 100% do limite. É lógica simples, sem dependências, e usa bem o módulo datetime.

Depois dessas duas, a ordem que eu seguiria é:

Exportar para Excel: é rápido com openpyxl, mas o PDF dá mais trabalho e rende menos, então eu faria só o Excel. O CSV também já abre no Excel, então o ganho é principalmente de formatação.
Gráficos: o matplotlib resolve em poucas linhas (por exemplo, pizza por categoria), mas só vale a pena depois que o filtro por mês existir.
Despesas recorrentes: exigem decidir quando e como gerar os lançamentos automáticos (aluguel, assinaturas), então é a mais delicada de acertar.
Interface gráfica (Tkinter/PyQt): eu deixaria por último, porque é praticamente reescrever a camada de interação. Se você quiser fazer, o ideal é separar antes a lógica (CRUD) da interface, o que o código atual já permite em boa parte.

Implementei a busca/filtro e o orçamento com alerta no expense_tracker.py. O menu agora vai de 1 a 9, com a busca na opção 7, o orçamento na 8 e a saída na 9.

Busca e filtro (opção 7)

Você preenche só os filtros que quiser e aperta Enter para ignorar os outros.
Os filtros disponíveis são categoria (sem diferenciar maiúsculas), data inicial, data final e palavra na descrição.
Os filtros se combinam. O resultado aparece na mesma tabela de sempre, com o total apenas das despesas encontradas.

Orçamento com alerta (opção 8)

O submenu permite definir um limite mensal geral e limites por categoria, ver o status do mês atual e remover limites.
Os limites ficam em um arquivo novo, budget.json, ao lado do expenses.csv.
Ao adicionar ou atualizar uma despesa, o programa confere o mês dela. Aparece WARNING a partir de 80% do limite e ALERT a partir de 100%, tanto para o limite geral quanto para o da categoria.
O percentual de aviso fica na constante WARNING_LEVEL, no topo do arquivo, se você quiser mudar.

Alguns comportamentos que podem surpreender:

O alerta vale para o mês da data da despesa. Se você lançar algo de outubro, o alerta compara com os gastos de outubro.
Excluir uma despesa não dispara alerta.
O status do orçamento mostra apenas o mês atual.

Testei adicionando despesas até passar dos limites, o aviso de 80%, o alerta de 100%, a atualização, a remoção de orçamento e os filtros. No primeiro teste, a sequência de entradas ficou desalinhada no final, então refiz um teste mais organizado, e os dois resultados bateram com o esperado. Não testei datas inválidas na busca de forma completa, só o caso de uma data digitada errada, que pede de novo.

Se quiser, atualizo também o python.md para refletir as novas funcionalidades.

Atualizei o python.md, mantendo o formato e o inglês do original, para refletir o que o programa faz agora:

Overview, Features e How it works: incluí a busca/filtro, o orçamento mensal com avisos (80%) e alertas (100%), a confirmação ao excluir e a validação de entradas. Também descrevi como o ID é gerado (maior ID + 1, sem repetir).
Skills e Technologies: adicionei o módulo json, o os que já era usado, e a validação de entradas.
Menu: é uma seção nova, com as opções de 1 a 9.
Data storage: além do expenses.csv, agora documenta o budget.json, com um exemplo do formato.
Possible improvements: tirei a busca/filtro e o orçamento com alerta, que já foram implementados. Ficaram exportar para Excel/PDF, gráficos, interface gráfica e despesas recorrentes.

A seção "Run the project" continua igual, porque o jeito de rodar não mudou. Só vale lembrar que o budget.json é criado na mesma pasta do expenses.csv quando você definir o primeiro limite.


import csv
import json
from datetime import datetime
import os

FILE = 'expenses.csv'
BUDGET_FILE = 'budget.json'
HEADER = ['ID', 'Date', 'Category', 'Amount', 'Description']
WARNING_LEVEL = 0.8  # avisa quando o gasto do mês chega a 80% do limite


# ---------- Funções auxiliares ----------

def initialize_file():
    if not os.path.exists(FILE):
        with open(FILE, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(HEADER)


def read_expenses():
    """Retorna todas as despesas (sem o cabeçalho) como lista de listas."""
    with open(FILE, mode='r', newline='') as file:
        reader = list(csv.reader(file))
    return reader[1:]


def write_expenses(rows):
    """Reescreve o arquivo inteiro com o cabeçalho + as linhas informadas."""
    with open(FILE, mode='w', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(HEADER)
        writer.writerows(rows)


def next_id(rows):
    """Novo ID = maior ID existente + 1 (nunca repete, mesmo após excluir)."""
    if not rows:
        return 1
    return max(int(row[0]) for row in rows) + 1


def ask_date(prompt, default):
    """Pede uma data no formato YYYY-MM-DD; Enter usa o valor padrão."""
    while True:
        value = input(prompt).strip() or str(default)
        try:
            datetime.strptime(value, '%Y-%m-%d')
            return value
        except ValueError:
            print("Invalid date. Use the format YYYY-MM-DD.")


def ask_optional_date(prompt):
    """Pede uma data opcional; Enter retorna None (sem filtro)."""
    while True:
        value = input(prompt).strip()
        if not value:
            return None
        try:
            datetime.strptime(value, '%Y-%m-%d')
            return value
        except ValueError:
            print("Invalid date. Use the format YYYY-MM-DD.")


def ask_amount(prompt, default=None):
    """Pede um valor numérico positivo; Enter mantém o padrão (se houver)."""
    while True:
        value = input(prompt).strip()
        if not value and default is not None:
            return default
        try:
            amount = float(value.replace(',', '.'))
            if amount <= 0:
                print("Amount must be greater than zero.")
                continue
            return amount
        except ValueError:
            print("Invalid amount. Enter a number.")


def ask_id(rows, action):
    """Pede um ID e retorna a linha correspondente (ou None)."""
    value = input(f"Enter the ID of the expense to {action}: ").strip()
    if not value.isdigit():
        print("Invalid ID.\n")
        return None
    for row in rows:
        if int(row[0]) == int(value):
            return row
    print("No expense found with that ID.\n")
    return None


def print_table(rows):
    """Imprime uma lista de despesas em formato de tabela, com o total."""
    print(f"\n{'ID':<4}| {'Date':<11}| {'Category':<10}| {'Amount':>8} | Description")
    print("-" * 60)
    total = 0.0
    for row in rows:
        print(f"{row[0]:<4}| {row[1]:<11}| {row[2]:<10}| {float(row[3]):>8.2f} | {row[4]}")
        total += float(row[3])
    print("-" * 60)
    print(f"Total Expenses: {total:.2f}\n")


# ---------- Orçamento (budget) ----------

def load_budget():
    """Carrega os limites mensais. Formato: {'overall': float|None, 'categories': {nome: float}}"""
    default = {'overall': None, 'categories': {}}
    if not os.path.exists(BUDGET_FILE):
        return default
    try:
        with open(BUDGET_FILE, mode='r') as file:
            data = json.load(file)
        return {'overall': data.get('overall'), 'categories': data.get('categories', {})}
    except (json.JSONDecodeError, OSError):
        print("Could not read the budget file. Starting with no budgets.")
        return default


def save_budget(budget):
    with open(BUDGET_FILE, mode='w') as file:
        json.dump(budget, file, indent=2)


def month_spent(rows, month, category=None):
    """Soma os gastos do mês (YYYY-MM), opcionalmente de uma categoria."""
    total = 0.0
    for row in rows:
        if not row[1].startswith(month):
            continue
        if category is not None and row[2].strip().lower() != category.lower():
            continue
        total += float(row[3])
    return total


def alert_if_needed(label, spent, limit, month):
    percent = spent / limit
    if percent >= 1:
        print(f"ALERT: {label} budget exceeded for {month}! "
              f"Spent {spent:.2f} of {limit:.2f} ({percent * 100:.0f}%).")
    elif percent >= WARNING_LEVEL:
        print(f"WARNING: {label} budget for {month} is at "
              f"{percent * 100:.0f}% ({spent:.2f} of {limit:.2f}).")


def check_budget(date, category):
    """Verifica os limites do mês da despesa informada e imprime alertas."""
    budget = load_budget()
    month = date[:7]
    rows = read_expenses()
    if budget['overall']:
        alert_if_needed("Overall", month_spent(rows, month), budget['overall'], month)
    limit = budget['categories'].get(category.strip().lower())
    if limit:
        alert_if_needed(f"'{category}'", month_spent(rows, month, category), limit, month)


def budget_status():
    budget = load_budget()
    month = str(datetime.now().date())[:7]
    rows = read_expenses()
    if not budget['overall'] and not budget['categories']:
        print("\nNo budgets defined yet.\n")
        return
    print(f"\nBudget status for {month}")
    print("-" * 52)
    if budget['overall']:
        spent = month_spent(rows, month)
        print(f"{'Overall':<15}: {spent:>9.2f} / {budget['overall']:<9.2f} "
              f"({spent / budget['overall'] * 100:.0f}%)")
    for category, limit in budget['categories'].items():
        spent = month_spent(rows, month, category)
        print(f"{category.capitalize():<15}: {spent:>9.2f} / {limit:<9.2f} "
              f"({spent / limit * 100:.0f}%)")
    print("-" * 52 + "\n")


def budget_menu():
    while True:
        print("\n--- BUDGET ---")
        print("1. Set overall monthly budget")
        print("2. Set budget for a category")
        print("3. View budget status (current month)")
        print("4. Remove a budget")
        print("5. Back")
        choice = input("Enter your choice: ").strip()
        budget = load_budget()
        if choice == '1':
            budget['overall'] = ask_amount("Overall monthly limit: ")
            save_budget(budget)
            print("Overall budget saved!")
        elif choice == '2':
            category = input("Category: ").strip().lower()
            if not category:
                print("Category cannot be empty.")
                continue
            budget['categories'][category] = ask_amount(f"Monthly limit for '{category}': ")
            save_budget(budget)
            print("Category budget saved!")
        elif choice == '3':
            budget_status()
        elif choice == '4':
            target = input("Category to remove (or 'overall'): ").strip().lower()
            if target == 'overall' and budget['overall']:
                budget['overall'] = None
            elif target in budget['categories']:
                del budget['categories'][target]
            else:
                print("No such budget.")
                continue
            save_budget(budget)
            print("Budget removed!")
        elif choice == '5':
            print()
            break
        else:
            print("Invalid choice. Try again.")


# ---------- CRUD ----------

def add_expense():
    rows = read_expenses()
    date = ask_date(f"Date (YYYY-MM-DD) [{datetime.now().date()}]: ", datetime.now().date())
    category = input("Category (e.g., Food, Travel): ").strip() or "Other"
    amount = ask_amount("Amount: ")
    description = input("Description: ").strip()
    with open(FILE, mode='a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow([next_id(rows), date, category, amount, description])
    print("Expense added successfully!")
    check_budget(date, category)
    print()


def view_expenses():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    print_table(rows)


def view_total():
    total = sum(float(row[3]) for row in read_expenses())
    print(f"\nTotal Expenses: {total:.2f}\n")


def view_summary():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    summary = {}
    for row in rows:
        summary[row[2]] = summary.get(row[2], 0.0) + float(row[3])
    print("\nSummary by Category")
    print("-" * 28)
    for category, value in summary.items():
        print(f"{category:<15}: {value:>10.2f}")
    print("-" * 28)
    print(f"{'Total':<15}: {sum(summary.values()):>10.2f}\n")


def search_expenses():
    """Filtra por categoria, período e/ou texto da descrição. Enter ignora um filtro."""
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    print("\nLeave a filter empty (press Enter) to ignore it.")
    category = input("Category: ").strip().lower()
    start = ask_optional_date("From date (YYYY-MM-DD): ")
    end = ask_optional_date("To date (YYYY-MM-DD): ")
    keyword = input("Keyword in description: ").strip().lower()

    results = []
    for row in rows:
        if category and row[2].strip().lower() != category:
            continue
        if start and row[1] < start:
            continue
        if end and row[1] > end:
            continue
        if keyword and keyword not in row[4].lower():
            continue
        results.append(row)

    if not results:
        print("\nNo expenses match those filters.\n")
        return
    print(f"\n{len(results)} expense(s) found:")
    print_table(results)


def update_expense():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    print_table(rows)
    row = ask_id(rows, "update")
    if row is None:
        return
    print("Press Enter to keep the current value.")
    row[1] = ask_date(f"Date [{row[1]}]: ", row[1])
    row[2] = input(f"Category [{row[2]}]: ").strip() or row[2]
    row[3] = ask_amount(f"Amount [{row[3]}]: ", default=row[3])
    new_description = input(f"Description [{row[4]}]: ").strip()
    row[4] = new_description or row[4]
    write_expenses(rows)
    print("Expense updated successfully!")
    check_budget(row[1], row[2])
    print()


def delete_expense():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    print_table(rows)
    row = ask_id(rows, "delete")
    if row is None:
        return
    confirm = input(f"Delete '{row[4]}' ({row[3]})? (y/n): ").strip().lower()
    if confirm == 'y':
        rows.remove(row)
        write_expenses(rows)
        print("Expense deleted successfully!\n")
    else:
        print("Deletion cancelled.\n")


# ---------- Menu ----------

def menu():
    initialize_file()
    actions = {
        '1': add_expense,
        '2': view_expenses,
        '3': view_total,
        '4': view_summary,
        '5': update_expense,
        '6': delete_expense,
        '7': search_expenses,
        '8': budget_menu,
    }
    while True:
        print("====== EXPENSE TRACKER ======")
        print("1. Add Expense")
        print("2. View All Expenses")
        print("3. View Total Expense")
        print("4. View Summary by Category")
        print("5. Update Expense")
        print("6. Delete Expense")
        print("7. Search / Filter Expenses")
        print("8. Budget")
        print("9. Exit")
        choice = input("Enter your choice: ").strip()
        if choice == '9':
            print("Goodbye!")
            break
        action = actions.get(choice)
        if action:
            action()
        else:
            print("Invalid choice. Try again.\n")


if __name__ == '__main__':
    menu()