#!/usr/bin/env python3
"""
Builds the ITD 132 Quiz 1 flashcards -> data/itd132-quiz1-flashcards.json.

    python3 tools/build_itd132_flashcards.py

One card per term, grouped into the same five topics as the quiz and guide. Terms must be unique
(the deck remembers "known" cards by term), and the build refuses incomplete cards.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd132-quiz1-flashcards.json")
CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


T = "Tables, Rows and Columns"
c(T, "Table (relation)", "A collection of rows and columns holding data about one subject. Formally a relation or entity.",
  "Keep each kind of thing (customers, products) in its own table so each fact is stored once.",
  "CREATE TABLE customer (\n  customer_id INT PRIMARY KEY,\n  full_name VARCHAR(80)\n);")
c(T, "Column (attribute)", "One named field of a table with a single datatype. Formally an attribute.",
  "Every value in the column must fit its type.",
  "full_name VARCHAR(80)")
c(T, "Row (tuple)", "One record in a table, with exactly one value for each column. Formally a tuple.",
  "Row order carries no meaning, so never rely on it.",
  "INSERT INTO customer VALUES (1, 'Joe Smith');")
c(T, "Redundancy", "The same fact stored in more than one place, which risks the copies disagreeing.",
  "Avoid it by giving each subject its own table and relating tables with keys.",
  "One customer table, referenced by orders")
c(T, "RDBMS", "Relational database management system: software that stores data in related tables and retrieves it with SQL.",
  "Use one when data needs integrity, relationships and multi-user access.",
  "MySQL")

K = "Primary and Foreign Keys"
c(K, "Primary key (PK)", "A column, or set of columns, that uniquely identifies each row. It must be unique and never NULL.",
  "Every table needs one. Keep it compact.",
  "customer_id INT PRIMARY KEY")
c(K, "Foreign key (FK)", "A column whose values refer to the primary key of another table, relating the rows of the two tables.",
  "Store the customer a purchase belongs to without copying the customer's details.",
  "orders.customer_id -> customer.customer_id")
c(K, "Composite key", "A primary key made of more than one column, needed when only the combination is unique.",
  "Use it for rows such as enrolments or order lines.",
  "PRIMARY KEY (order_id, product_id)")
c(K, "Referenced table", "The table whose primary key a foreign key points to. Also called the primary table.",
  "Identify which side of a relationship holds the PK.",
  "customer, for orders.customer_id")
c(K, "Referencing table", "The table that contains the foreign key. Also called the foreign table.",
  "Identify which side of a relationship holds the FK.",
  "orders, for orders.customer_id")
c(K, "NULL", "A marker meaning no value is stored. A primary key can never be NULL.",
  "Allow it only in columns where a value may legitimately be missing.",
  "returned_on DATE NULL")

O = "Indexes, Views and Routines"
c(O, "Index", "A structure that relates each indexed value to where its rows are stored, so lookups are fast, like a book's index.",
  "Add one on columns you search often. Queries are written the same either way.",
  "CREATE INDEX idx_surname ON patron (surname);")
c(O, "View", "A virtual table whose rows are computed from base tables each time it is used. It holds no data itself.",
  "Give users a simplified or restricted picture of the data.",
  "CREATE VIEW active_patron AS\n  SELECT * FROM patron WHERE is_active = 1;")
c(O, "Base table", "A table that actually stores data, as opposed to a view.",
  "Tell stored data apart from computed results.",
  "patron, gadget")
c(O, "Stored procedure", "A named routine saved inside the database that can take parameters and run queries or other tasks.",
  "Reuse one piece of logic, such as customers who spent more than an amount you pass in.",
  "CALL big_spenders(500);")
c(O, "Trigger", "A special stored procedure that fires automatically when data in its table is inserted, updated or deleted.",
  "Enforce business rules, such as writing an audit record whenever a row is deleted.",
  "AFTER DELETE ON staff ... INSERT INTO audit ...")

S = "SQL Queries and the System Catalog"
c(S, "SELECT", "The statement that retrieves data. The list after it chooses the columns.",
  "Read data without changing it.",
  "SELECT title, price FROM book;")
c(S, "WHERE", "A restriction that keeps only the rows meeting a condition.",
  "Filter rows; the column list chooses columns, WHERE chooses rows.",
  "SELECT title FROM book WHERE price > 15;")
c(S, "JOIN", "Links rows from two or more tables by comparing key columns and returning the matching rows. The tables themselves are unchanged.",
  "Combine data across a relationship, matching an FK with its PK.",
  "SELECT o.order_id, c.full_name\nFROM orders o JOIN customer c\n  ON o.customer_id = c.customer_id;")
c(S, "INSERT / UPDATE / DELETE", "The statements that add rows, change existing rows, and remove rows.",
  "Modify data; SELECT only reads it.",
  "DELETE FROM book WHERE book_id = 9;")
c(S, "CREATE / DROP", "Statements that build or remove database objects such as tables and views.",
  "Define or remove structure rather than data.",
  "DROP TABLE old_orders;")
c(S, "System catalog", "Special system tables, also called the data dictionary, that hold information about the database itself.",
  "Look up what tables, columns and users exist. Read it; never alter it directly.",
  "information_schema.columns")
c(S, "Metadata", "Data about data, such as a table's column names and types.",
  "Distinguish descriptions of the data from the data itself.",
  "Column name: price, type: DECIMAL(8,2)")

D = "MySQL Data Types"
c(D, "Data type", "The contract that tells MySQL how to interpret stored bits, how much space to use, and which operations are valid.",
  "Pick the smallest, most specific type that represents the data faithfully.",
  "age TINYINT UNSIGNED")
c(D, "TINYINT / SMALLINT / MEDIUMINT", "Integers of 1, 2 and 3 bytes. TINYINT covers -128 to 127 (0 to 255 unsigned).",
  "Use the smallest that fits to save space and keep indexes lean.",
  "is_open TINYINT")
c(D, "INT", "A 4-byte integer, about plus or minus 2.1 billion. The default integer.",
  "General counters and IDs.",
  "visits INT")
c(D, "BIGINT", "An 8-byte integer, about plus or minus 9.2 quintillion.",
  "IDs or counters that may pass 2 billion.",
  "event_id BIGINT")
c(D, "UNSIGNED", "An attribute that forbids negative values, doubling the positive range.",
  "Use it when a value can never be negative.",
  "quantity INT UNSIGNED")
c(D, "DECIMAL(M,D)", "Exact fixed-point number with M total digits and D after the point. No rounding error.",
  "Money.",
  "price DECIMAL(8,2)")
c(D, "FLOAT / DOUBLE", "Approximate floating-point numbers of 4 and 8 bytes. Fast but imprecise.",
  "Scientific measurements. Avoid for currency, since 0.1 + 0.2 may not equal 0.3.",
  "ratio DOUBLE")
c(D, "BOOLEAN", "A true/false value stored in one byte as 1 or 0.",
  "On/off flags.",
  "is_active BOOLEAN")
c(D, "CHAR(N)", "A fixed-length string padded to N characters.",
  "Uniform values such as two-letter state codes.",
  "state CHAR(2)")
c(D, "VARCHAR(N)", "A variable-length string of up to N characters (65,535 bytes at most). The default for most text.",
  "Names, emails and other text of varying length.",
  "last_name VARCHAR(50)")
c(D, "TEXT family", "Variable-length text from TINYTEXT up to LONGTEXT (255 bytes to 4 GB). Indexes poorly.",
  "Only when content may exceed VARCHAR limits.",
  "body LONGTEXT")
c(D, "BLOB family", "Binary large objects: raw bytes for images and files.",
  "Store binary content in the database.",
  "photo MEDIUMBLOB")
c(D, "ENUM", "One value from a fixed list. Compact and self-validating, but painful to change later.",
  "A known, stable set of choices.",
  "tier ENUM('bronze','silver','gold')")
c(D, "SET", "Zero or more values from a predefined list.",
  "Several choices at once, such as days a class meets.",
  "days SET('Mon','Tue','Wed')")
c(D, "DATE / TIME", "DATE holds YYYY-MM-DD (years 1000-9999). TIME holds HH:MM:SS and can exceed 24 hours.",
  "Calendar dates; clock times or elapsed durations.",
  "born DATE\nrun_time TIME")
c(D, "DATETIME", "A date and time stored as written, with no time zone conversion and a wide range.",
  "Predictable literal timestamps and dates beyond 2038.",
  "starts_at DATETIME")
c(D, "TIMESTAMP", "A 4-byte date and time stored as UTC and converted to the session time zone. Limited to 1970-2038.",
  "Row creation or change times that follow the viewer's time zone.",
  "created_at TIMESTAMP")
c(D, "YEAR", "A one-byte value that holds a year only.",
  "A model year or graduation year.",
  "model_year YEAR")
c(D, "JSON", "A native type for structured documents, with validation and path-based queries.",
  "Flexible, semi-structured data. Not where a relational column would do.",
  "settings JSON")

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "ITD 132 Quiz 1 Flashcards",
            "guideFile": "data/itd132-quiz1-guide.json", "quizFile": "data/itd132-quiz1.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd132-quiz1-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
