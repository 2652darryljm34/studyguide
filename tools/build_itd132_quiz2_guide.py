#!/usr/bin/env python3
"""
Builds the ITD 132 Quiz 2 study guide -> data/itd132-quiz2-guide.json.

    python3 tools/build_itd132_quiz2_guide.py

One of a set built together: this guide, the flashcards (build_itd132_quiz2_flashcards.py), the quiz
(build_itd132_quiz2.py) and the walkthroughs (build_itd132_quiz2_walkthroughs.py). All follow the same
seven topics in the same order and link to each other. When a topic changes in one, change it in all.
"""

import json
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "itd132-quiz2-guide.json")
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


section("1. Creating and Altering Tables",
    p("**DDL** (data definition language) defines the **structure** of the database. **DML** works on the **rows**. CREATE and ALTER are DDL."),
    table(["Statement", "Does"],
          ["`CREATE TABLE`", "Builds a **new** table"],
          ["`ALTER TABLE ... ADD COLUMN`", "Adds a column to an existing table"],
          ["`ALTER TABLE ... MODIFY COLUMN`", "Changes the definition of an **existing** column (type, size, NULL-ability, default)"],
          ["`ALTER TABLE ... DROP COLUMN`", "Removes a column **and its data**"]),
    sql("CREATE TABLE member (\n  member_id INT PRIMARY KEY,\n  full_name VARCHAR(80) NOT NULL,\n  status    VARCHAR(10) DEFAULT 'active'\n);\n\nALTER TABLE member ADD COLUMN phone VARCHAR(20);\nALTER TABLE member MODIFY COLUMN full_name VARCHAR(120) NOT NULL;"),
    h("DEFAULT"),
    p("`DEFAULT` supplies the value used when an INSERT **leaves the column out**. It does not stop another value being supplied. A column added with `ADD COLUMN` gives **NULL** to the existing rows unless it has a DEFAULT."),
    note("Watch out:", "`MODIFY COLUMN` **restates the whole definition**. Changing `qty INT NOT NULL DEFAULT 0` with `MODIFY COLUMN qty BIGINT` drops the NOT NULL and the default. Write them again. Shrinking a column (VARCHAR(100) to VARCHAR(30)) can reject or cut data that no longer fits."))

section("2. Constraints",
    p("A **constraint** is a rule the database enforces on every INSERT and UPDATE. A row that breaks it is **rejected**, and nothing is stored."),
    table(["Constraint", "Rule", "Example"],
          ["**NOT NULL**", "A value **must be supplied**", "`hire_date DATE NOT NULL`"],
          ["**UNIQUE**", "No two rows may share a value (NULLs are allowed, and may repeat)", "`email VARCHAR(80) UNIQUE`"],
          ["**CHECK**", "A condition must **not be false**", "`rating INT CHECK (rating BETWEEN 1 AND 5)`"],
          ["**PRIMARY KEY**", "**Unique and not null**; one per table", "`member_id INT PRIMARY KEY`"]),
    sql("ALTER TABLE member ADD CONSTRAINT uq_email UNIQUE (email);"),
    ul("A table has **one** primary key but can have **many** UNIQUE columns.",
       "**CHECK** is enforced from **MySQL 8.0.16**; older versions parse it and ignore it.",
       "A CHECK is rejected only when the condition is **false**. With a NULL the result is *unknown*, so the row passes. Add **NOT NULL** to forbid NULL."),
    note("Remember:", "Duplicates: UNIQUE. A value must exist: NOT NULL. A condition on the value: CHECK."))

section("3. Inserting, Updating and Deleting",
    p("**DML** statements change the rows: **INSERT** adds, **UPDATE** changes, **DELETE** removes."),
    sql("INSERT INTO shelf (shelf_id, label) VALUES (4, 'Garden');\nINSERT INTO shelf (shelf_id, label) VALUES (5, 'Tools'), (6, 'Paint');  -- several rows\n\nUPDATE item SET price = 9.99, stock = 40 WHERE item_id = 12;\n\nDELETE FROM item WHERE item_id = 12;"),
    ul("**INSERT** with a column list gives values to those columns; the rest take their DEFAULT or NULL. With **no column list** you must give a value for **every** column, in table order.",
       "**UPDATE** needs `SET`. Several columns are separated by commas. **No WHERE means every row.**",
       "**DELETE FROM t** with no WHERE removes **every row** but keeps the empty table. **DROP TABLE** removes the table itself.",
       "Deleting a **parent** row that child rows still reference fails by default (foreign key)."),
    note("Safe habit:", "Run a **SELECT with the same WHERE** first to see exactly which rows an UPDATE or DELETE will touch."))

section("4. Transactions",
    p("A **transaction** groups statements into one unit: **all of it takes effect, or none of it**. A bank transfer needs both the subtraction and the addition."),
    sql("START TRANSACTION;          -- or BEGIN\nUPDATE account SET balance = balance - 100 WHERE account_id = 1;\nUPDATE account SET balance = balance + 100 WHERE account_id = 2;\nCOMMIT;                         -- make it permanent\n-- or ROLLBACK;                 -- undo everything since START"),
    table(["Statement", "Does"],
          ["`START TRANSACTION` / `BEGIN`", "Opens a transaction"],
          ["`COMMIT`", "Makes all its changes **permanent**"],
          ["`ROLLBACK`", "**Undoes** all changes since the transaction began"]),
    ul("**Autocommit** is on by default in MySQL: each statement commits itself unless you start a transaction.",
       "After **COMMIT**, a ROLLBACK cannot undo it.",
       "A dropped connection before COMMIT **rolls the work back**.",
       "**DDL** (CREATE, ALTER, DROP) causes an **implicit commit** and cannot be rolled back.",
       "**InnoDB** supports transactions; MyISAM does not."),
    h("ACID"),
    table(["Property", "Meaning"],
          ["**A**tomicity", "All of the transaction happens, or none of it"],
          ["**C**onsistency", "The data obeys all the rules before and after"],
          ["**I**solation", "Transactions in progress do not see each other's partial work"],
          ["**D**urability", "Committed changes survive a crash"]))

section("5. Indexes",
    p("An **index** lets the database find rows by a column's value **without reading the whole table**, like the index of a book. It does not change the result of a query, only the speed."),
    ul("**BTREE** (the default in InnoDB): a balanced, sorted tree. Handles `=`, ranges (`<`, `>`, `BETWEEN`), `ORDER BY` and a `LIKE` that starts with fixed text.",
       "**HASH** (MEMORY engine): exact matches only, no ranges.",
       "A **composite** index on `(last_name, first_name)` is used from its **leftmost** column on: a filter on `last_name` can use it, a filter on only `first_name` cannot."),
    sql("CREATE INDEX idx_member_email ON member (email);\nCREATE UNIQUE INDEX idx_member_card ON member (card_no);\nDROP INDEX idx_member_email ON member;"),
    table(["Benefit", "Cost"],
          ["Faster searches, joins and sorts on the indexed column", "Extra storage"],
          ["A UNIQUE index also enforces uniqueness", "Slower INSERT, UPDATE and DELETE, since the index is kept up to date"]),
    note("Remember:", "A primary key and a UNIQUE column get an index automatically. Index columns used often in WHERE and JOIN that have many different values. More indexes is not always better."))

section("6. Index Usage and EXPLAIN",
    p("Put **EXPLAIN** in front of a SELECT to see how MySQL plans to run it. It shows the plan, not the rows."),
    sql("EXPLAIN SELECT * FROM member WHERE email = 'ana@example.com';"),
    table(["Column", "Tells you"],
          ["`type`", "How the table is accessed. **ALL = full table scan** (the worst); `ref` and `range` use an index"],
          ["`possible_keys`", "Indexes that **could** be used"],
          ["`key`", "The index **actually chosen** (NULL = none)"],
          ["`rows`", "Estimated number of rows **examined**"],
          ["`Extra`", "More detail, such as `Using filesort` (a separate sort step)"]),
    p("Typical fix: EXPLAIN shows `type = ALL`, `key = NULL`, `rows = 48000`. Add an index on the filtered column and EXPLAIN again: `type = ref`, `key = idx_...`, `rows` falls."),
    h("When an index is not used"),
    ul("A **function on the column**: `WHERE YEAR(order_date) = 2024`. Rewrite as a range on the plain column: `order_date >= '2024-01-01' AND order_date < '2025-01-01'`.",
       "A **leading wildcard**: `LIKE '%kafor'`. `LIKE 'Ok%'` can use the index.",
       "Filtering on a **non-leftmost** column of a composite index.",
       "A **low-selectivity** column (such as Y/N where most rows match): the optimizer may prefer a scan.",
       "A very **small table**: scanning is cheap."),
    note("Remember:", "EXPLAIN again after adding an index to confirm it is used."))

section("7. Locks",
    p("**Locks** stop users working at the same time from corrupting or overwriting each other's data. A transaction's locks are released when it ends with **COMMIT or ROLLBACK**."),
    table(["Level", "Scope", "Effect"],
          ["**Table-level**", "A whole table", "Simple and cheap, but others wait to write **any** row (MyISAM, `LOCK TABLES`)"],
          ["**Row-level**", "Only the rows touched", "Different rows can be updated at the same time (**InnoDB**)"],
          ["**Field-level**", "One value in one row", "The finest grain: most concurrency, most overhead (a concept; MySQL does not offer it)"]),
    p("**Finer locks** let more users work at once but cost more to track. **Coarser locks** are cheap but block more."),
    table(["Lock type", "Held by", "Blocks"],
          ["**Shared** (read)", "Many users at once", "Writers"],
          ["**Exclusive** (write)", "One user", "Readers and other writers"]),
    ul("**Deadlock:** two transactions each hold a lock the other needs, so neither can continue. InnoDB detects it and **rolls one back**.",
       "`SELECT ... FOR UPDATE` reads rows and places exclusive row locks on them until the transaction ends.",
       "Keep transactions **short** so locks are held briefly."))

guide = {
    "title": "ITD 132 Quiz 2 Study Guide",
    "description": "CREATE and ALTER TABLE, constraints, INSERT, UPDATE and DELETE, transactions, indexes, EXPLAIN and locks, in the same order as the quiz, flashcards and walkthroughs.",
    "quizFile": "data/itd132-quiz2.json",
    "flashcardsFile": "data/itd132-quiz2-flashcards.json",
    "sections": SECTIONS,
}

if __name__ == "__main__":
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("%d sections -> data/itd132-quiz2-guide.json" % len(SECTIONS))
