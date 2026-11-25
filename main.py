import csv 
from datetime import datetime
import os

FILE = 'expenses.csv'

def initialize_file():
    if not os.path.exists(FILE):
        with open(FILE, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(['ID', 'Date', 'Category', 'Amount', 'Description'])

def add_expense():

def view_expenses():



#