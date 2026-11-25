# Expense Tracker Python
    A simple command-line Expense Tracker to add, view, search, update and delete your expenses, with monthly budget alerts.

* OVERVIEW
    This project helps users track their daily expenses. It allows you to add expenses with a category, amount and description, view all expenses, search and filter them, see summary by category, update and delete expenses. You can also set monthly budgets (overall or per category) and get alerts when you are close to or over the limit. All data is stored in files (CSV and JSON) so your expenses and budgets are saved permanently.

* FEATURES
    - Add new expense
    - View all expenses
    - View total expenses
    - View summary by category
    - Update an expense
    - Delete an expense (with confirmation)
    - Search / filter by category, date range and description keyword
    - Monthly budget (overall and per category) with warning and alert messages
    - Input validation (dates, amounts and IDs)
    - Data saved in CSV and JSON files
    - Easy to use in command line

* SKILLS USED
    - Functions
    - Lists & Dictionaries
    - File Handling (CSV and JSON)
    - Date & Time Module
    - Input Validation
    - Conditional Statements
    - Loops 

* TECHNOLOGIES
    - Python 3, csv, json, datetime, os modules

* HOW IT WORKS
    - Add expense with date, category, amount and description
    - Store expense in a CSV file with a unique ID (highest ID + 1, never repeated)
    - View all expenses in a table
    - See total expense and summary by category
    - Search and filter expenses (leave a filter empty to ignore it)
    - Update or delete any expense by its ID
    - Set monthly budgets; when you add or update an expense, the program checks that month's spending:
        - WARNING when spending reaches 80% of the limit
        - ALERT when spending reaches or passes 100% of the limit
    - Data persists even closing app

* MENU
    1. Add Expense
    2. View All Expenses
    3. View Total Expense
    4. View Summary by Category
    5. Update Expense
    6. Delete Expense
    7. Search / Filter Expenses
    8. Budget (set overall / category limit, view status, remove a limit)
    9. Exit

* RUN THE PROJECT
    - Install Python 3.x
    - Copy the code into a file named expense_tracker.py
    - Open terminal/command prompt
    - Run the program => python expense_tracker.py

* DATA STORAGE
    All expenses are stored in a CSV file (expenses.csv) in the following format:

        id |    date    |  Category  | Amount | Description
         1 | 2024-05-27 |    Food    | 250.00 | Lunch with friend
         2 | 2024-05-27 |   Travel   | 120.00 | Auto fare
         3 | 2024-05-28 |  Shopping  | 500.00 | New T-Shirt

    Budgets are stored in a JSON file (budget.json), created when you set the first limit:

        {
          "overall": 500.0,
          "categories": {
            "food": 200.0
          }
        }

* POSSIBLE IMPROVEMENTS
    - Add export to Excel / PDF
    - Add charts for visual summary
    - Build a GUI using Tkinter/ PyQt
    - Add recurring expenses
