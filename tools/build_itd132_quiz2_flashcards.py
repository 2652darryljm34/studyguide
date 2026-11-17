#!/usr/bin/env python3
"""
Builds the ITD 132 Quiz 2 flashcards -> data/itd132-quiz2-flashcards.json.

    python3 tools/build_itd132_quiz2_flashcards.py

One card per term, grouped into the same seven topics as the quiz, guide and walkthroughs. Terms must be
unique (the deck remembers "known" cards by term), and the build refuses incomplete cards.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd132-quiz2-flashcards.json")
CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


T = "Creating and Altering Tables"
c(T, "DDL", "Data definition language: the statements that define or change the structure of the database.",
  "CREATE, ALTER and DROP are DDL. In MySQL they end the current transaction.", "CREATE TABLE member (...);")
c(T, "CREATE TABLE", "Builds a new table with its columns, data types and constraints.",
  "Use it to define a table that does not exist yet.", "CREATE TABLE member (\n  member_id INT PRIMARY KEY,\n  full_name VARCHAR(80) NOT NULL\n);")
c(T, "ALTER TABLE ... ADD COLUMN", "Adds a new column to an existing table. Existing rows get NULL, or the DEFAULT.",
  "Use it when a table needs one more attribute.", "ALTER TABLE member ADD COLUMN phone VARCHAR(20);")
c(T, "ALTER TABLE ... MODIFY COLUMN", "Changes the definition of an existing column. It restates the whole definition.",
  "Use it to change a type or size; repeat NOT NULL and DEFAULT to keep them.", "ALTER TABLE book MODIFY COLUMN title VARCHAR(120) NOT NULL;")
c(T, "DEFAULT", "The value a column takes when an INSERT leaves it out.",
  "Use it for a sensible starting value such as a status.", "status VARCHAR(10) DEFAULT 'open'")

T = "Constraints"
c(T, "Constraint", "A rule the database enforces on every insert and update; a row that breaks it is rejected.",
  "Use them to keep bad data out whichever application writes it.", "NOT NULL, UNIQUE, CHECK, PRIMARY KEY")
c(T, "NOT NULL", "A constraint that requires a value in the column.",
  "Use it for facts every row must have.", "hire_date DATE NOT NULL")
c(T, "UNIQUE", "A constraint that stops two rows sharing a value in the column. NULLs are allowed.",
  "Use it for values that identify a row but are not the primary key, such as an email.", "email VARCHAR(80) UNIQUE")
c(T, "CHECK", "A constraint that rejects a row when a condition on its values is false. Enforced from MySQL 8.0.16.",
  "Use it for ranges and simple rules; a NULL passes, so add NOT NULL too.", "rating INT CHECK (rating BETWEEN 1 AND 5)")
c(T, "ADD CONSTRAINT", "Adds a named constraint to an existing table with ALTER TABLE.",
  "Use it to add a rule after the table is built.", "ALTER TABLE member ADD CONSTRAINT uq_email UNIQUE (email);")

T = "Inserting, Updating and Deleting"
c(T, "DML", "Data manipulation language: INSERT, UPDATE and DELETE, the statements that change rows.",
  "Use them to add, change and remove data; the table structure stays the same.", "INSERT, UPDATE, DELETE")
c(T, "INSERT", "Adds one or more rows. Name the columns, or supply a value for every column in order.",
  "Columns left out take their DEFAULT or NULL.", "INSERT INTO shelf (shelf_id, label) VALUES (4, 'Garden');")
c(T, "UPDATE", "Changes values in existing rows: SET gives the new values, WHERE picks the rows.",
  "No WHERE means every row is changed.", "UPDATE item SET price = 9.99 WHERE item_id = 12;")
c(T, "DELETE", "Removes rows that match the WHERE condition. With no WHERE it removes every row but keeps the table.",
  "To remove the table itself use DROP TABLE.", "DELETE FROM item WHERE item_id = 12;")
c(T, "DROP TABLE", "Removes a table completely: its structure and all of its rows.",
  "Use it when the table is no longer needed.", "DROP TABLE item;")

T = "Transactions"
c(T, "Transaction", "A group of statements treated as one unit: all of it takes effect, or none of it.",
  "Use it when several changes must succeed together, such as a transfer.", "Subtract 100 from A and add 100 to B")
c(T, "START TRANSACTION / BEGIN", "Opens a transaction; changes stay provisional until COMMIT or ROLLBACK.",
  "Start one before a group of related changes.", "START TRANSACTION;")
c(T, "COMMIT", "Makes all the changes of the current transaction permanent.",
  "Run it when every step has succeeded; a ROLLBACK cannot undo it afterwards.", "COMMIT;")
c(T, "ROLLBACK", "Undoes all the changes made since the transaction began.",
  "Run it when a step fails, to restore the starting state.", "ROLLBACK;")
c(T, "Autocommit", "MySQL's default: each statement commits on its own unless a transaction was started.",
  "START TRANSACTION switches it off until COMMIT or ROLLBACK.", "A lone UPDATE is saved immediately")
c(T, "ACID", "Atomicity, consistency, isolation, durability: the properties of a reliable transaction.",
  "Atomic is all or nothing; durable means committed work survives a crash.", "InnoDB supports ACID transactions")

T = "Indexes"
c(T, "Index", "A structure that lets the database find rows by a column's value without reading the whole table.",
  "Speeds up reads; slows writes and uses storage. It does not change results.", "Like the index of a book")
c(T, "BTREE", "A balanced, sorted tree: the default index type, good for equality, ranges and ORDER BY.",
  "Use it for most columns.", "InnoDB's default index")
c(T, "HASH index", "An index that jumps to an exact value. It handles equality only, not ranges.",
  "Used by the MEMORY engine for exact lookups.", "WHERE id = 5")
c(T, "CREATE INDEX", "Builds an index on one or more columns: CREATE INDEX name ON table (column).",
  "Index columns used often in WHERE and JOIN that have many different values.", "CREATE INDEX idx_member_email ON member (email);")
c(T, "DROP INDEX", "Removes an index: DROP INDEX name ON table.",
  "Drop indexes nobody uses, since they slow writes.", "DROP INDEX idx_member_email ON member;")
c(T, "Composite index", "An index on two or more columns together, used from its leftmost column on.",
  "A filter on the first column can use it; a filter on only the second cannot.", "CREATE INDEX idx_name ON person (last_name, first_name);")

T = "Index Usage and EXPLAIN"
c(T, "EXPLAIN", "A prefix for SELECT that shows the execution plan: which index is used and how many rows are examined.",
  "Use it to find out why a query is slow. It does not return the rows.", "EXPLAIN SELECT * FROM member WHERE email = 'a@x.com';")
c(T, "Full table scan (type = ALL)", "MySQL reads every row of the table to answer the query.",
  "A warning sign on a big table; an index on the filtered column may help.", "type = ALL, key = NULL, rows = 48000")
c(T, "key and possible_keys", "possible_keys lists indexes that could be used; key is the one actually chosen (NULL if none).",
  "Check key after adding an index to see that it is used.", "key = idx_member_email")
c(T, "Non-sargable condition", "A condition that cannot use an index on the column, such as a function on the column or a leading wildcard.",
  "Rewrite as a range on the plain column, or a LIKE that begins with fixed text.", "WHERE YEAR(order_date) = 2024")

T = "Locks"
c(T, "Lock", "A mechanism that stops users working at the same time from corrupting each other's data.",
  "Released when the transaction ends with COMMIT or ROLLBACK.", "An UPDATE locks the row it changes")
c(T, "Table-level lock", "A lock on a whole table: others wait to write any row.",
  "Simple and cheap, but limits concurrency.", "LOCK TABLES member WRITE;")
c(T, "Row-level lock", "A lock on only the rows a statement touches, so other rows stay available.",
  "InnoDB uses it, so many users can update one table at once.", "SELECT * FROM seat WHERE seat_id = 5 FOR UPDATE;")
c(T, "Field-level lock", "A lock on a single value in a single row: the finest granularity.",
  "Most concurrency but most overhead; a concept, not offered by MySQL.", "One cell of one row")
c(T, "Shared and exclusive locks", "A shared (read) lock can be held by many users; an exclusive (write) lock by one, blocking all others.",
  "Readers can share; a writer needs the data to itself.", "Two readers at once, one writer alone")
c(T, "Deadlock", "Two transactions each hold a lock the other needs, so neither can continue.",
  "InnoDB detects it and rolls one transaction back. Keep transactions short.", "A waits for B's row while B waits for A's row")

if __name__ == "__main__":
    seen = set()
    for card in CARDS:
        assert all(card.values()), card
        assert card["term"] not in seen, card["term"]
        seen.add(card["term"])
    deck = {"title": "ITD 132 Quiz 2 Flashcards",
            "guideFile": "data/itd132-quiz2-guide.json", "quizFile": "data/itd132-quiz2.json", "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d cards in %d topics -> data/itd132-quiz2-flashcards.json" % (len(CARDS), len({x["topic"] for x in CARDS})))
