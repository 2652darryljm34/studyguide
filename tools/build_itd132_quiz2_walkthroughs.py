#!/usr/bin/env python3
"""
Builds the ITD 132 Quiz 2 step-through walkthroughs -> data/itd132-quiz2-walkthroughs.json
(shown by walkthrough.html). One walkthrough per guide section.

    python3 tools/build_itd132_quiz2_walkthroughs.py

Reuses the visual helpers and validation of build_itd140_walkthroughs.py. Table contents are computed or
traced by hand from the statements shown in each step.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_itd140_walkthroughs import flow, table, step, validate  # noqa: E402

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itd132-quiz2-walkthroughs.json")
GUIDE = "data/itd132-quiz2-guide.json"
QUIZ = "data/itd132-quiz2.json"
W = []


def add(w_id, title, topic, blurb, steps):
    W.append((w_id, title, topic, blurb, steps))


# 1 ---- alter table
H1 = ["member_id", "full_name", "status", "phone"]
add("alter-table", "Growing a table with ALTER TABLE", "1. Creating and Altering Tables",
    "Create a table, add a column, then modify it, watching the rows.", [
    step("CREATE TABLE builds it", "CREATE TABLE member (member_id INT PRIMARY KEY, full_name VARCHAR(50) NOT NULL, status VARCHAR(10) DEFAULT 'active'); then two rows are inserted, one of which leaves status out.",
         table(H1[:3], [["1", "Ana Ruiz", "paused"], ["2", "Bo Chen", "active"]], [(1, 2)])),
    step("DEFAULT fills the gap", "Bo's INSERT named only member_id and full_name. The column was left out, so status took its DEFAULT, 'active'.",
         table(["Insert", "status written"], [["INSERT (1, 'Ana Ruiz', 'paused')", "paused (given)"], ["INSERT (2, 'Bo Chen') without status", "active (DEFAULT)"]], [(1, 1)])),
    step("ADD COLUMN: existing rows get NULL", "ALTER TABLE member ADD COLUMN phone VARCHAR(20); adds the column. The rows that already exist have no phone, so they hold NULL.",
         table(H1, [["1", "Ana Ruiz", "paused", "NULL"], ["2", "Bo Chen", "active", "NULL"]], [(0, 3), (1, 3)])),
    step("MODIFY COLUMN restates the whole definition", "ALTER TABLE member MODIFY COLUMN full_name VARCHAR(120); widens the column, but the original NOT NULL was not repeated, so it is lost. Write VARCHAR(120) NOT NULL to keep it.",
         table(["Statement", "full_name afterwards"], [["MODIFY COLUMN full_name VARCHAR(120)", "VARCHAR(120), NULL allowed"], ["MODIFY COLUMN full_name VARCHAR(120) NOT NULL", "VARCHAR(120), NOT NULL kept"]], [(0, 1), (1, 1)])),
])

# 2 ---- constraints
H2 = ["INSERT (email, rating, hired)", "UNIQUE email", "CHECK rating 1-5", "NOT NULL hired", "Result"]
add("constraints", "Which constraint rejects which row", "2. Constraints",
    "Try five inserts against UNIQUE, CHECK and NOT NULL.", [
    step("The table's rules", "member(email VARCHAR(80) UNIQUE, rating INT CHECK (rating BETWEEN 1 AND 5), hired DATE NOT NULL). One row already exists: ana@x.com, rating 4, 2024-01-10.",
         table(["email", "rating", "hired"], [["ana@x.com", "4", "2024-01-10"]])),
    step("A clean row passes all three", "('bo@x.com', 3, '2024-02-01') is a new email, a rating inside 1 to 5 and a hire date. It is stored.",
         table(H2, [["('bo@x.com', 3, '2024-02-01')", "new: ok", "3: ok", "given: ok", "Stored"]], [(0, 4)])),
    step("Each rule has its own failure", "A repeated email fails UNIQUE, a rating of 9 fails CHECK, and a missing hire date fails NOT NULL. Any one failure rejects the whole row and nothing is stored.",
         table(H2, [["('ana@x.com', 3, '2024-03-01')", "duplicate: FAIL", "ok", "ok", "Rejected"],
                    ["('cy@x.com', 9, '2024-03-01')", "ok", "9: FAIL", "ok", "Rejected"],
                    ["('di@x.com', 2, NULL)", "ok", "ok", "NULL: FAIL", "Rejected"]], [(0, 1), (1, 2), (2, 3)])),
    step("NULL is a special case", "A NULL rating does not fail CHECK, because the condition is unknown, not false. A second NULL email does not fail UNIQUE either. Add NOT NULL if NULL must be forbidden.",
         table(H2, [["('ed@x.com', NULL, '2024-04-01')", "ok", "unknown: passes", "ok", "Stored"], ["(NULL, 3, '2024-04-02')", "NULL: allowed", "ok", "ok", "Stored"]], [(0, 2), (1, 1)])),
])

# 3 ---- DML
SH = ["item_id", "name", "price"]
add("dml", "INSERT, UPDATE and DELETE on one table", "3. Inserting, Updating and Deleting",
    "Follow the rows of an item table through five statements, including the missing-WHERE mistake.", [
    step("Starting rows", "An item table with three rows.", table(SH, [["1", "Hammer", "12.00"], ["2", "Saw", "20.00"], ["3", "Level", "8.00"]])),
    step("INSERT adds a row", "INSERT INTO item (item_id, name, price) VALUES (4, 'Clamp', 6.50); adds row 4.",
         table(SH, [["1", "Hammer", "12.00"], ["2", "Saw", "20.00"], ["3", "Level", "8.00"], ["4", "Clamp", "6.50"]], [(3, 0), (3, 1), (3, 2)])),
    step("UPDATE with WHERE changes one row", "UPDATE item SET price = 9.99 WHERE item_id = 3; only item 3 changes.",
         table(SH, [["1", "Hammer", "12.00"], ["2", "Saw", "20.00"], ["3", "Level", "9.99"], ["4", "Clamp", "6.50"]], [(2, 2)])),
    step("UPDATE without WHERE changes every row", "UPDATE item SET price = price + 1; has no WHERE, so all four rows change. Run a SELECT with the same WHERE first to see what will be touched.",
         table(SH, [["1", "Hammer", "13.00"], ["2", "Saw", "21.00"], ["3", "Level", "10.99"], ["4", "Clamp", "7.50"]], [(r, 2) for r in range(4)])),
    step("DELETE removes rows, DROP removes the table", "DELETE FROM item WHERE item_id = 2; removes only the Saw. DELETE FROM item; with no WHERE would remove all rows but keep the empty table; DROP TABLE item; removes the table itself.",
         table(SH, [["1", "Hammer", "13.00"], ["3", "Level", "10.99"], ["4", "Clamp", "7.50"]])),
])

# 4 ---- transactions
AH = ["account_id", "balance"]
add("transactions", "A transfer with COMMIT and with ROLLBACK", "4. Transactions",
    "Move 100 between two accounts, then see what ROLLBACK does.", [
    step("Starting balances", "Account 1 holds 500 and account 2 holds 200. Total: 700.", table(AH, [["1", "500"], ["2", "200"]])),
    step("START TRANSACTION, then subtract", "START TRANSACTION; UPDATE account SET balance = balance - 100 WHERE account_id = 1; Inside the transaction the total is now 600: 100 is missing until the second update runs.",
         table(AH, [["1", "400"], ["2", "200"]], [(0, 1)])),
    step("Add to the other account", "UPDATE account SET balance = balance + 100 WHERE account_id = 2; The total is back to 700.", table(AH, [["1", "400"], ["2", "300"]], [(1, 1)])),
    step("COMMIT makes it permanent", "COMMIT; Both changes are saved together and other users now see them. A ROLLBACK after this cannot undo them.", table(AH, [["1", "400"], ["2", "300"]], [(0, 1), (1, 1)])),
    step("The failure case: ROLLBACK", "Suppose the second UPDATE had failed. Run ROLLBACK; instead of COMMIT. The subtraction is undone and the balances return to 500 and 200, so no money is lost.",
         table(["Ending with", "Account 1", "Account 2", "Total"], [["COMMIT (both updates ok)", "400", "300", "700"], ["ROLLBACK (second failed)", "500", "200", "700"]], [(1, 1), (1, 2)])),
])

# 5 ---- indexes
add("indexes", "How an index finds a row", "5. Indexes",
    "Compare a table scan with a lookup through a sorted index.", [
    step("Without an index: read every row", "WHERE email = 'kim@x.com' on a table of 48,000 rows with no index on email: MySQL must read the rows one by one until it has checked them all.",
         table(["Method", "Rows read"], [["Full table scan", "up to 48,000"]], [(0, 1)])),
    step("CREATE INDEX builds a sorted structure", "CREATE INDEX idx_member_email ON member (email); builds a BTREE: a sorted tree of email values, each pointing at its row.",
         flow(["Root", "Branch", "Leaf: kim@x.com", "Row"], 0)),
    step("A lookup walks the tree", "The search compares at each level and drops down one branch: root, branch, leaf, then the row. Three or four steps instead of 48,000. Ranges and ORDER BY work too because the values are sorted.",
         flow(["Root", "Branch", "Leaf: kim@x.com", "Row"], 2)),
    step("The price: slower writes", "Every INSERT, UPDATE or DELETE must also update the index, and the index takes storage. DROP INDEX idx_member_email ON member; removes it if nobody uses it.",
         table(["", "Without index", "With index"], [["Search by email", "Scan the table", "Tree lookup"], ["INSERT", "Write the row", "Write the row and update the index"], ["Storage", "Table only", "Table plus index"]], [(0, 2), (1, 2), (2, 2)])),
])

# 6 ---- EXPLAIN
EH = ["type", "possible_keys", "key", "rows"]
add("explain", "Reading EXPLAIN before and after an index", "6. Index Usage and EXPLAIN",
    "Spot a full table scan, add an index, and check that EXPLAIN now uses it.", [
    step("EXPLAIN shows the plan, not the rows", "EXPLAIN SELECT * FROM member WHERE email = 'kim@x.com'; returns one row describing how MySQL would run the query.",
         table(EH, [["ALL", "NULL", "NULL", "48000"]], [(0, 0), (0, 2), (0, 3)])),
    step("Read it: a full table scan", "type = ALL means every row is read, key = NULL means no index is used and rows = 48000 is the number examined. This is the sign an index may help.",
         table(["Column", "Value", "Meaning"], [["type", "ALL", "Full table scan"], ["key", "NULL", "No index used"], ["rows", "48000", "Rows examined"]], [(0, 1), (1, 1), (2, 1)])),
    step("Add an index and EXPLAIN again", "CREATE INDEX idx_member_email ON member (email); then the same EXPLAIN gives type = ref, key = idx_member_email and rows = 1.",
         table(EH, [["ref", "idx_member_email", "idx_member_email", "1"]], [(0, 0), (0, 2), (0, 3)])),
    step("A function on the column hides the index", "WHERE YEAR(order_date) = 2024 cannot use an index on order_date, because the function is applied to every value. The rewrite order_date >= '2024-01-01' AND order_date < '2025-01-01' can. LIKE 'Ok%' uses an index but LIKE '%kafor' does not.",
         table(["Condition", "Can use the index?"], [["WHERE YEAR(order_date) = 2024", "No (function on the column)"], ["WHERE order_date >= '2024-01-01' AND order_date < '2025-01-01'", "Yes (range on the column)"], ["WHERE name LIKE 'Ok%'", "Yes (fixed start)"], ["WHERE name LIKE '%kafor'", "No (leading wildcard)"]], [(1, 1), (2, 1)])),
])

# 7 ---- locks
add("locks", "Who waits when two users update", "7. Locks",
    "Compare table-level and row-level locks, then watch a deadlock form.", [
    step("Two users, two different rows", "User A updates seat 5 and user B updates seat 9 in the same table at the same moment.",
         table(["User", "Statement", "Row wanted"], [["A", "UPDATE seat SET ... WHERE seat_id = 5", "5"], ["B", "UPDATE seat SET ... WHERE seat_id = 9", "9"]])),
    step("Table-level lock: B waits", "With a table lock, A holds the whole table, so B must wait even though the rows differ. Simple, but low concurrency.",
         table(["User", "Lock", "Outcome"], [["A", "Table (write)", "Runs"], ["B", "Waits for the table", "Waits until A finishes"]], [(1, 2)])),
    step("Row-level lock: both run", "With row locks (InnoDB), A locks only row 5 and B locks only row 9, so both run at once. Finer locks give more concurrency at the cost of tracking many locks. Field-level, a single value, is the finest grain in concept.",
         table(["User", "Lock", "Outcome"], [["A", "Row 5 (exclusive)", "Runs"], ["B", "Row 9 (exclusive)", "Runs"]], [(0, 2), (1, 2)])),
    step("Same row: shared and exclusive", "Many users can hold a shared (read) lock on a row together. An exclusive (write) lock is held by one user and blocks readers and other writers until COMMIT or ROLLBACK.",
         table(["Held", "Another reader", "Another writer"], [["Shared lock", "Allowed", "Waits"], ["Exclusive lock", "Waits", "Waits"]], [(0, 1), (1, 1), (1, 2)])),
    step("Deadlock", "A locks row 5 and then wants row 9. B locks row 9 and then wants row 5. Each waits for the other, so neither can continue. InnoDB detects this and rolls one transaction back so the other can finish.",
         table(["Step", "User A", "User B"], [["1", "Locks row 5", "Locks row 9"], ["2", "Wants row 9: waits", "Wants row 5: waits"], ["3", "Deadlock: one is rolled back", "The other continues"]], [(1, 1), (1, 2), (2, 1)])),
])


def main():
    problems, out = [], []
    with open(os.path.join(HERE, "..", GUIDE), encoding="utf-8") as fh:
        sections = [s["name"] for s in json.load(fh)["sections"]]
    for w_id, title, topic, blurb, steps in W:
        if topic not in sections:
            problems.append("%s: topic %r is not a guide section" % (w_id, topic))
        validate(w_id, steps, problems)
        out.append({"id": w_id, "title": title, "topic": topic, "blurb": blurb, "steps": steps})
    problems += ["no walkthrough for guide section %r" % n for n in sections if n not in [w[2] for w in W]]
    if problems:
        print("\n".join(problems))
        return 1
    doc = {"title": "ITD 132 Quiz 2 Walkthroughs", "guideFile": GUIDE, "quizFile": QUIZ, "walkthroughs": out}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print("%d walkthroughs, %d steps -> data/itd132-quiz2-walkthroughs.json" % (len(out), sum(len(w[4]) for w in W)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
