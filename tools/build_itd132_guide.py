#!/usr/bin/env python3
"""
Builds the ITD 132 Quiz 1 study guide -> data/itd132-quiz1-guide.json.

    python3 tools/build_itd132_guide.py

One of a set of three built together: this guide, the flashcards (build_itd132_flashcards.py) and
the quiz (build_itd132_quiz1.py). All three follow the same five topics in the same order and link
to each other. When a topic changes in one, change it in all three.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itd132-quiz1-guide.json")

SECTIONS = []


def section(name, *blocks):
    SECTIONS.append({"name": name, "blocks": list(blocks)})


def h(t): return {"type": "heading", "text": t}
def sub(t): return {"type": "subheading", "text": t}
def p(t): return {"type": "paragraph", "text": t}
def ul(*i): return {"type": "list", "items": list(i)}
def table(headers, *rows): return {"type": "table", "headers": headers, "rows": [list(r) for r in rows]}
def sql(t): return {"type": "code", "lang": "sql", "text": t}
def note(label, t): return {"type": "note", "label": label, "text": t}


section("1. Tables, Rows and Columns",
    h("Everything lives in tables"),
    p("A relational database management system (RDBMS) keeps all its data in **tables** made of **rows** and **columns**. Tables are related to each other through **keys**."),
    ul("Each column has one **datatype** (integer, text, date...), and every value in it must fit that type.",
       "Each row holds exactly **one value per column**: no lists in a cell.",
       "The **order** of rows and columns has no meaning.",
       "Each table is about **one subject** (patients, products, customers). A fact is entered once, which removes redundancy and inconsistency."),
    sub("Formal and informal names"),
    table(["Formal term", "Informal term", "Non-relational equivalent"],
          ["Relation / entity", "Table", "File"],
          ["Attribute", "Column / field", "Field"],
          ["Tuple", "Row / record", "Record"]),
    note("Remember:", "Two departments that both need customer details share **one** customer table. Copying the data into each department's own table is exactly what the relational design avoids."))

section("2. Primary and Foreign Keys",
    h("Primary key (PK)"),
    ul("Identifies each row **uniquely**.",
       "Must be **unique** and **never NULL**.",
       "Every table must have one. If none is declared, all the columns together become the key.",
       "Keep it **compact**."),
    sub("Composite primary key"),
    p("When no single column identifies a row but a combination does, the key is made of **several columns**. An order-lines table with `order_id`, `product_id`, `quantity` and `ship_date` needs `order_id` + `product_id`."),
    h("Foreign key (FK)"),
    p("A column whose values **refer to the primary key** of another table. It is what relates rows in two tables. Its name may differ from the key it points to, and its value must match an existing PK value."),
    table(["Term", "Meaning"],
          ["Referencing (foreign) table", "The table that **holds the foreign key**"],
          ["Referenced (primary) table", "The table whose **primary key is pointed to**"]),
    sql("-- orders.customer_id is the FK; customer.customer_id is the PK\nSELECT * FROM orders JOIN customer\n  ON orders.customer_id = customer.customer_id;"),
    note("Watch out:", "An order with `customer_id = 7` when no customer 7 exists is a broken relationship. The FK must refer to a PK value that is actually there."))

section("3. Indexes, Views and Routines",
    h("Beyond tables"),
    table(["Object", "What it is", "Key point"],
          ["Index", "Lets the database find rows by a column's value quickly, like a book's index", "Speeds up lookups; **transparent** to the user"],
          ["View", "A **virtual table** computed from base tables when accessed", "Holds **no data** of its own"],
          ["Stored procedure", "A routine saved in the database that can take **parameters**", "Reusable queries and tasks"],
          ["Trigger", "A special stored procedure that **fires automatically** on insert, update or delete", "Maintains business rules, e.g. an audit record"]),
    note("Remember:", "The tables that actually hold the data are **base tables**. A view is computed from them each time it is used."))

section("4. SQL Queries and the System Catalog",
    h("SELECT"),
    sql("SELECT title, price      -- which columns\nFROM book                 -- which table\nWHERE price > 15;         -- which rows"),
    ul("The list after `SELECT` chooses **columns**.", "`FROM` names the **table**.", "`WHERE` is the **filter on rows**."),
    h("JOIN"),
    p("A join links rows from two or more tables by comparing **key columns** (an FK to the PK it refers to) and returning the rows that match. It produces a result; it does **not** merge or change the tables."),
    sql("SELECT gadget.gadget_title, maker.maker_name\nFROM gadget JOIN maker ON gadget.maker_id = maker.maker_id;"),
    h("Other SQL statements"),
    table(["Statement", "Does"],
          ["`SELECT`", "Reads data"], ["`INSERT`", "Adds rows"], ["`UPDATE`", "Changes rows"],
          ["`DELETE`", "Removes rows"], ["`CREATE` / `DROP`", "Builds or removes tables, views and other objects"]),
    h("The system catalog"),
    p("Every database has **system tables** (the **data dictionary** or **system catalog**) holding **metadata**: data about data, such as the tables, columns and users. You read them but **never alter them directly**."))

section("5. MySQL Data Types",
    h("Why types exist"),
    p("The same bits can be a number, text or a date. The type is the contract that says which, reserves the right space, rejects nonsense, and enables correct sorting, math and date arithmetic. **Rule of thumb: pick the smallest, most specific type that faithfully represents the data.**"),
    sub("Numeric"),
    table(["Type", "Storage", "Notes"],
          ["`TINYINT`", "1 byte", "-128 to 127 (0 to 255 unsigned); good for flags"],
          ["`SMALLINT`", "2 bytes", "about ±32,767"],
          ["`MEDIUMINT`", "3 bytes", "about ±8.3 million"],
          ["`INT`", "4 bytes", "about ±2.1 billion; the default integer"],
          ["`BIGINT`", "8 bytes", "about ±9.2 quintillion; for IDs that may exceed 2 billion"],
          ["`DECIMAL(M,D)`", "varies", "**Exact**; use for money"],
          ["`FLOAT` / `DOUBLE`", "4 / 8 bytes", "**Approximate**; avoid for currency (0.1 + 0.2 may not be 0.3)"],
          ["`BIT(M)`", "varies", "Raw bit values"],
          ["`BOOLEAN`", "1 byte", "True (1) or false (0)"]),
    p("`UNSIGNED` means no negative values, which doubles the positive range."),
    sub("String"),
    table(["Type", "Storage", "Notes"],
          ["`CHAR(N)`", "fixed N", "Pads to a fixed length; best for uniform values such as codes"],
          ["`VARCHAR(N)`", "variable", "Up to 65,535 bytes; the default for most text"],
          ["`TEXT` family", "variable", "TINY to LONG, 255 bytes to 4 GB; indexes poorly"],
          ["`BINARY` / `VARBINARY`", "fixed / variable", "Like CHAR / VARCHAR but raw bytes"],
          ["`BLOB` family", "variable", "Binary large objects: images, files"],
          ["`ENUM`", "1-2 bytes", "**One** value from a fixed list; hard to alter later"],
          ["`SET`", "1-8 bytes", "**Zero or more** values from a predefined list"]),
    p("`utf8mb4` uses up to **4 bytes per character**."),
    sub("Date and time"),
    table(["Type", "Storage", "Notes"],
          ["`DATE`", "3 bytes", "YYYY-MM-DD, years 1000-9999"],
          ["`TIME`", "3 bytes", "HH:MM:SS; can hold durations beyond 24 hours"],
          ["`DATETIME`", "5 bytes", "Date and time, literal value, no time zone conversion, wide range"],
          ["`TIMESTAMP`", "4 bytes", "Stored as UTC, converted to the session time zone; **1970 to 2038**"],
          ["`YEAR`", "1 byte", "A year only"]),
    note("Watch out:", "Never store dates as strings: you lose sorting, validation and date arithmetic. `JSON` is a native type for flexible, semi-structured documents, but do not use it where a proper relational column would do."))

guide = {
    "title": "ITD 132 Quiz 1 Study Guide",
    "description": "Relational database concepts, keys, indexes and views, SELECT and JOIN, the system catalog, and MySQL data types, in the same order as the quiz and flashcards.",
    "quizFile": "data/itd132-quiz1.json",
    "flashcardsFile": "data/itd132-quiz1-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd132-quiz1-guide.json" % len(SECTIONS))
