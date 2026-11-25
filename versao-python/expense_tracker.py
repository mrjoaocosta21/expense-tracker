import csv
from datetime import datetime
import os

FILE = 'expenses.csv'
HEADER = ['ID', 'Date', 'Category', 'Amount', 'Description']


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
    print("Expense added successfully!\n")


def view_expenses():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    print(f"\n{'ID':<4}| {'Date':<11}| {'Category':<10}| {'Amount':>8} | Description")
    print("-" * 60)
    total = 0.0
    for row in rows:
        print(f"{row[0]:<4}| {row[1]:<11}| {row[2]:<10}| {float(row[3]):>8.2f} | {row[4]}")
        total += float(row[3])
    print("-" * 60)
    print(f"Total Expenses: {total:.2f}\n")


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


def update_expense():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    view_expenses()
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
    print("Expense updated successfully!\n")


def delete_expense():
    rows = read_expenses()
    if not rows:
        print("\nNo expenses found.\n")
        return
    view_expenses()
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
    }
    while True:
        print("====== EXPENSE TRACKER ======")
        print("1. Add Expense")
        print("2. View All Expenses")
        print("3. View Total Expense")
        print("4. View Summary by Category")
        print("5. Update Expense")
        print("6. Delete Expense")
        print("7. Exit")
        choice = input("Enter your choice: ").strip()
        if choice == '7':
            print("Goodbye!")
            break
        action = actions.get(choice)
        if action:
            action()
        else:
            print("Invalid choice. Try again.\n")


if __name__ == '__main__':
    menu()