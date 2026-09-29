"""Neutralize spreadsheet formulas in user-controlled CSV text."""

import csv


FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def safe_csv_cell(value):
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


class SafeCSVWriter:
    def __init__(self, output):
        self.writer = csv.writer(output)

    def writerow(self, cells):
        return self.writer.writerow([safe_csv_cell(value) for value in cells])
