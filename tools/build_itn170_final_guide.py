#!/usr/bin/env python3
"""
Builds the ITN 170 final review guide -> data/itn170-final-guide.json.

    python3 tools/build_itn170_final_guide.py

The guide is one of a set of three built together for the Linux final: this guide, the
flashcards (tools/build_itn170_flashcards.py) and the quiz (tools/build_itn170_final.py).
It follows the same 13 topics as the quiz, in the same order, so the three can be used side
by side, and links to the other two. When a topic changes in one, change it in all three.
"""

import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itn170-final-guide.json")

SECTIONS = []


def section(name, *blocks):
    SECTIONS.append({"name": name, "blocks": list(blocks)})


def h(text): return {"type": "heading", "text": text}
def sub(text): return {"type": "subheading", "text": text}
def p(text): return {"type": "paragraph", "text": text}
def ul(*items): return {"type": "list", "items": list(items)}
def table(headers, *rows): return {"type": "table", "headers": headers, "rows": [list(r) for r in rows]}
def code(text): return {"type": "code", "lang": "shell", "text": text}
def plain(text): return {"type": "code", "text": text}
def note(label, text): return {"type": "note", "label": label, "text": text}


# ------------------------------------------------------------------ 1
section("1. Navigating the File System",
    h("Where am I, and who am I?"),
    p("Most mistakes at the command line come from being somewhere, or someone, you did not expect. These commands answer both questions."),
    table(["Command", "What it does", "Example"],
          ["`pwd`", "Prints the full path of the directory you are in", "`pwd`"],
          ["`whoami`", "Prints the account you are logged in as", "`whoami`"],
          ["`ls`", "Lists the files in a directory", "`ls /etc`"],
          ["`ls -l`", "Long listing: permissions, owner, group, size, date, name", "`ls -l`"],
          ["`ls -ltr`", "Long listing, sorted by time, **reversed**: oldest first, newest last", "`ls -ltr /var/log`"],
          ["`cd`", "Changes directory; with no argument it goes home", "`cd /etc`"],
          ["`clear`", "Clears the screen", "`clear`"],
          ["`man`", "Shows a command's manual page (`q` quits, `/` searches)", "`man ls`"]),
    sub("The dots"),
    code("cd ..      # up to the parent directory\ncd .       # stay exactly where you are\ncd ~       # home\ncd -       # back to the previous directory"),
    note("Remember:", "`ls -ltr` is three options bundled together: `-l` long, `-t` by time, `-r` reverse. Because of the reverse, the file you changed most recently is the **last** line, right above your prompt."),
    sub("Becoming root"),
    table(["Command", "What it does", "Whose password?"],
          ["`su -`", "Switches to root and loads root's login environment", "Root's"],
          ["`sudo command`", "Runs **one** command with root privileges, if you are allowed to", "Your own"],
          ["`sudo su`", "Uses sudo to start a root shell", "Your own"]),
    note("Watch out:", "A prompt ending in `#` means you are root. Every command you type there runs with full power, so check the prompt before anything destructive."))

# ------------------------------------------------------------------ 2
section("2. File Maintenance",
    h("Creating, copying, moving and deleting"),
    table(["Command", "What it does", "Example"],
          ["`touch f`", "Creates an empty file, or updates the timestamp of an existing one", "`touch notes.txt`"],
          ["`mkdir d`", "Makes a directory (`-p` also makes missing parents)", "`mkdir -p a/b/c`"],
          ["`cp a b`", "Copies a file (`-r` for a directory)", "`cp notes.txt notes.bak`"],
          ["`mv a b`", "Moves a file, or renames it when the destination is in the same directory", "`mv old.txt new.txt`"],
          ["`rm f`", "Deletes a file; there is no trash can", "`rm draft.txt`"],
          ["`rmdir d`", "Deletes an **empty** directory only", "`rmdir old-notes`"],
          ["`rm -r d`", "Deletes a directory and everything inside it", "`rm -r old-project`"],
          ["`rm -rf d`", "Same, but forced: no prompts and no complaints about missing files", "`rm -rf build/`"]),
    sub("Changing the properties of a file"),
    table(["Command", "What it changes", "Example"],
          ["`chmod`", "The permission bits", "`chmod 644 notes.txt`"],
          ["`chown`", "The owner (and the group, as `owner:group`)", "`sudo chown alice:staff report.txt`"],
          ["`chgrp`", "The owning group only", "`sudo chgrp developers app.conf`"]),
    note("Gotcha:", "`rmdir` refuses to remove a directory that has anything in it. That is not a bug: it is the safety. `rm -r` is the one that removes contents too, and `rm -rf` is the one that does so without asking."))

# ------------------------------------------------------------------ 3
section("3. Permissions",
    h("Reading a long listing"),
    plain("-rwxr-xr--  1  alice  staff  120  Oct 6  backup.sh\n|\\_/\\_/\\_/\n| |  |  |\n| |  |  +-- others: r--  (read only)\n| |  +----- group:  r-x  (read and execute)\n| +-------- owner:  rwx  (read, write and execute)\n+---------- type:   -    (ordinary file; d is a directory)"),
    h("Octal (numeric) permissions"),
    p("Each permission has a value: **read = 4, write = 2, execute = 1**. Add the values you want for each of the three groups, owner first."),
    table(["Digit", "Permissions", "Digit", "Permissions"],
          ["7", "rwx", "3", "-wx"],
          ["6", "rw-", "2", "-w-"],
          ["5", "r-x", "1", "--x"],
          ["4", "r--", "0", "---"]),
    table(["Mode", "Meaning", "Typical use"],
          ["`755`", "rwx r-x r-x", "Programs, scripts, directories"],
          ["`644`", "rw- r-- r--", "Ordinary files"],
          ["`600`", "rw- --- ---", "Private files such as SSH keys"],
          ["`750`", "rwx r-x ---", "Shared with a group, closed to everyone else"]),
    sub("Symbolic mode"),
    code("chmod u+x script.sh     # add execute for the owner, leave all else alone\nchmod g-w file.txt       # take write away from the group\nchmod o=r file.txt       # others: read only\nchmod a+r file.txt       # everyone gets read"),
    note("Scripts:", "To run `./myscript` the file needs **execute** permission (and read). `bash myscript` only needs read, because bash opens the file rather than executing it."))

# ------------------------------------------------------------------ 4
section("4. Wildcards & Brace Expansion",
    h("The shell expands them first"),
    p("Wildcards are replaced by the shell with matching file names **before** the command runs. Brace expansion is different: it builds names from a list, whether or not any file exists."),
    table(["Pattern", "Matches", "Example"],
          ["`*`", "Zero or more characters", "`ls project*`"],
          ["`?`", "Exactly one character", "`ls project?`"],
          ["`[abc]`", "One character from the set", "`ls project[aegh]`"],
          ["`[a-h]`", "One character from the range", "`ls project[a-h]`"],
          ["`[!135]`", "One character that is **not** in the set", "`ls project[!135]`"],
          ["`{a,b}` / `{1..4}`", "Builds a list of names (does not search)", "`touch project{1..4}`"]),
    sub("Worked example"),
    p("Suppose the directory holds `project`, `project1` to `project4`, `project12` to `project14`, and `projecta`, `projecte`, `projectg`, `projecth`."),
    table(["Command", "Lists"],
          ["`ls project*`", "All 12 names (plain `project` too)"],
          ["`ls project?`", "project1-4, projecta, projecte, projectg, projecth"],
          ["`ls project??`", "project12, project13, project14"],
          ["`ls project[13]?`", "project12, project13, project14"],
          ["`ls project[!135]`", "project2, project4, projecta, projecte, projectg, projecth"]),
    note("Remember:", "`touch project{1..4} project{12..14} project{a,e,g,h}` creates 4 + 3 + 4 = 11 files. Braces make names; `*` and `?` find names that already exist."))

# ------------------------------------------------------------------ 5
section("5. Viewing Files",
    h("Showing a file's contents"),
    table(["Command", "What it does"],
          ["`cat f`", "Prints the whole file"],
          ["`tac f`", "Prints it with the last line first (cat backwards)"],
          ["`more f`", "One screen at a time; Space for the next page"],
          ["`less f`", "Pager that scrolls both ways; `j`/`k` or arrows, `/` to search, `q` to quit"],
          ["`head f`", "First 10 lines (`-n 3` for 3)"],
          ["`tail f`", "Last 10 lines (`-n 3` for 3; `-f` follows new lines)"],
          ["`nano f`", "Simple editor with its commands shown on screen: Ctrl+O saves, Ctrl+X exits"],
          ["`vi f`", "The standard editor; see the vi section"]),
    code("head -n 3 notes.txt     # the first three lines\ntail -n 3 notes.txt     # the last three\ntac notes.txt | head    # the last ten lines, newest first"),
    note("Remember:", "`head` and `tail` both default to **10** lines."))

# ------------------------------------------------------------------ 6
section("6. Users & System Info",
    h("Who is on the system"),
    table(["Command", "Shows"],
          ["`who`", "Who is logged in right now"],
          ["`w`", "Who is logged in, what they are running, and the load"],
          ["`last`", "The history of past logins and reboots"],
          ["`finger`", "A summary of users: name, terminal, idle time, login time (may need installing)"],
          ["`id`", "Your user ID, group ID and every group you belong to"]),
    h("About the machine"),
    table(["Command", "Shows", "Example"],
          ["`date`", "The date and time (root can set it with `-s`)", "`date`"],
          ["`uptime`", "How long it has been running, users, load average", "`uptime`"],
          ["`hostname`", "The machine's name", "`hostname`"],
          ["`uname`", "Kernel and OS information (`-r` release, `-a` all)", "`uname -r`"],
          ["`which`", "The full path of the program a command name runs", "`which pwd`"],
          ["`cal`", "A calendar for a month or a year", "`cal 9 2016`"],
          ["`bc`", "A command-line calculator", "`echo '2+3*4' | bc`"]),
    note("Remember:", "`cal 9 2016` is September 2016 (month first). `cal 2016` shows the whole year."))

# ------------------------------------------------------------------ 7
section("7. Processes, Services & Monitoring",
    h("Services with systemctl"),
    p("`systemctl` replaced the older `service` command in RHEL 7. It controls systemd services and normally needs root."),
    table(["Command", "Effect"],
          ["`systemctl start httpd`", "Starts the service **now**"],
          ["`systemctl stop httpd`", "Stops it now"],
          ["`systemctl restart httpd`", "Stops then starts it"],
          ["`systemctl enable httpd`", "Makes it start automatically at **boot**"],
          ["`systemctl disable httpd`", "Stops it starting at boot"],
          ["`systemctl status httpd`", "Shows whether it is running"],
          ["`systemctl enable --now httpd`", "Enable at boot and start it now, in one go"]),
    h("Looking at the system"),
    table(["Command", "Shows"],
          ["`ps`", "Processes (`ps aux` for every process)"],
          ["`top`", "A live view of processes with CPU and memory use (`q` quits)"],
          ["`kill PID`", "Sends a signal to a process; the default asks it to end, `-9` forces it"],
          ["`free -h`", "RAM and swap"],
          ["`df -h`", "Free disk space per file system"],
          ["`dmesg`", "Kernel messages: hardware and driver warnings or errors"],
          ["`iostat 1`", "Disk and CPU I/O statistics, refreshed every second"],
          ["`netstat`", "Network connections, routes and interfaces (older; `ss` and `ip` replace it)"],
          ["`cat /proc/cpuinfo`", "A virtual file describing the CPUs"],
          ["`cat /proc/meminfo`", "A virtual file describing memory"]),
    note("Gotcha:", "`start` and `enable` are different questions: one is about **now**, the other about the **next boot**. An ordinary user can only `kill` their own processes."))

# ------------------------------------------------------------------ 8
section("8. Finding Files & Links",
    h("find and locate"),
    table(["", "find", "locate"],
          ["How it works", "Walks the real directories every time", "Looks names up in a prebuilt database"],
          ["Speed", "Slower, especially from `/`", "Very fast"],
          ["Up to date?", "Always", "Only as fresh as the last `updatedb`"]),
    code("find . -name \"notes.txt\"             # here and below\nfind / -name \"ifcfg-enp0s3\" 2>/dev/null   # whole system, hide the permission errors\nlocate notes.txt\nsudo updatedb                            # refresh locate's database"),
    h("Hard links and soft links"),
    table(["", "Hard link", "Soft (symbolic) link"],
          ["Made with", "`ln original link`", "`ln -s original link`"],
          ["What it is", "A second name for the **same data**", "A tiny file holding the **path** to the original"],
          ["Original deleted or renamed", "Still works; the data lives until the last name goes", "**Breaks** (a dangling link)"],
          ["Crosses file systems?", "No", "Yes"]),
    code("ln original.txt copy.txt       # hard link\nln -s /etc/hosts hostslink      # soft link\nls -l hostslink                 # shows:  hostslink -> /etc/hosts"),
    note("Remember:", "A soft link is like a shortcut. A hard link is like giving the same file two names."))

# ------------------------------------------------------------------ 9
section("9. Redirection, Pipes & Text Tools",
    h("Redirection and pipes"),
    table(["Symbol", "Effect", "Example"],
          ["`>`", "Sends output to a file, **replacing** its contents", "`ls -ltr > filelist.txt`"],
          ["`>>`", "**Appends** output to the end of a file", "`date >> log.txt`"],
          ["`|`", "Feeds one command's output into the next", "`ls -l /etc | more`"]),
    h("The text toolkit"),
    table(["Tool", "Does", "Example"],
          ["`grep`", "Prints lines that match (`-c` counts, `-i` ignores case)", "`grep Cat pets`"],
          ["`sort`", "Sorts lines (`-n` numeric, `-r` reverse, `-k2` by column 2)", "`sort -k2 pets`"],
          ["`uniq`", "Collapses **adjacent** duplicates (`-c` counts)", "`sort pets | uniq`"],
          ["`awk`", "Works field by field: `$1` first, `$2` second", "`awk '{print $2}' pets`"],
          ["`sed`", "Edits a stream; `s/old/new/` substitutes", "`sed 's/Cat/Feline/' pets`"],
          ["`tee`", "Writes to a file **and** to the screen", "`grep Dog pets | tee dogs.txt`"],
          ["`wc -l`", "Counts lines", "`wc -l pets`"]),
    sub("Putting it together"),
    p("Take a file called `pets` with a name and a kind on each line:"),
    plain("Rex Dog\nTom Cat\nFido Dog\nKit Cat\nMax Dog"),
    code("awk '{print $2}' pets | sort | uniq -c\n#   2 Cat\n#   3 Dog"),
    note("Why sort first?", "`uniq` only compares each line with the one **before** it. Sorting puts identical lines side by side, so `sort | uniq -c` counts every group correctly."))

# ------------------------------------------------------------------ 10
section("10. Users, Groups & sudo",
    h("Account commands"),
    table(["Command", "Does"],
          ["`useradd name`", "Creates an account (`adduser` is the same on RHEL/CentOS)"],
          ["`passwd name`", "Sets a password; a new account stays locked until you do"],
          ["`groupadd name`", "Creates a group"],
          ["`usermod`", "Changes an existing account"],
          ["`su - name`", "Starts a login session as that user (`exit` comes back)"]),
    h("Giving someone sudo rights"),
    p("On CentOS and RHEL, members of the **wheel** group may run any command as root through sudo."),
    code("sudo su                       # 1. become root\nuseradd newuser               # 2. create the account\npasswd newuser                # 3. set a password\nusermod -aG wheel newuser     # 4. add to wheel\nsu - newuser                  # 5. switch to the new user\nsudo whoami                   #    prints: root"),
    note("Never forget the -a:", "`usermod -G wheel newuser` **replaces** all the user's supplementary groups with just wheel. `-aG` **appends**, which is what you want."),
    note("Which password?", "sudo asks for the password of the person typing, not root's. The rules come from `/etc/sudoers`, which you edit with `visudo`; on RHEL it grants the wheel group full access."))

# ------------------------------------------------------------------ 11
section("11. The vi Editor",
    h("Modes"),
    p("vi opens in **command mode**, where every key is a command. That is why typing seems to do nothing at first. Press `i` to enter **insert mode** and type; press `Esc` to go back."),
    table(["Key", "Does"],
          ["`i`", "Insert mode (type text)"],
          ["`Esc`", "Back to command mode"],
          ["`r`", "Replace the character under the cursor"],
          ["`x`", "Delete the character under the cursor"],
          ["`dd`", "Delete the current line"],
          ["`u`", "Undo the last change"],
          ["`/word`", "Search forward (`n` for the next match)"],
          ["`:q!`", "Quit **without** saving"],
          ["`:wq` or `ZZ`", "Save and quit (`ZZ` is Shift+Z twice)"]),
    note("Remember:", "The `!` in `:q!` means \"even though there are unsaved changes\". If you only want to leave a file you did not change, `:q` is enough."))

# ------------------------------------------------------------------ 12
section("12. Scheduling with cron",
    h("The five time fields"),
    plain("minute  hour  day-of-month  month  day-of-week   command\n  0-59  0-23      1-31        1-12     0-7 (Sun)\n\n  *   means every value        */30   means every 30th        1-5   is a range"),
    table(["Entry", "Runs"],
          ["`0 3 * * * /root/backup.sh`", "Every day at 3:00 a.m."],
          ["`30 16 2 * * /path/script.sh`", "4:30 p.m. on the 2nd of every month"],
          ["`0 22 * * 1-5 /path/job`", "10:00 p.m., Monday to Friday"],
          ["`*/30 * * * * /path/job`", "Every 30 minutes"],
          ["`5 4 * * sun /path/job`", "4:05 a.m. every Sunday"],
          ["`23 0-23/2 * * * /path/job`", "23 minutes past every second hour (00:23, 02:23, ...)"]),
    h("Managing your crontab"),
    table(["Command", "Does"],
          ["`crontab -e`", "Edit your jobs (opens vi by default)"],
          ["`crontab -l`", "List your jobs"],
          ["`crontab -r`", "Remove **all** your jobs"],
          ["`crontab -u name -l`", "List another user's jobs (as root)"]),
    table(["Shortcut", "Same as"],
          ["`@hourly`", "`0 * * * *`"],
          ["`@daily` / `@midnight`", "`0 0 * * *`"],
          ["`@weekly`", "`0 0 * * 0`"],
          ["`@monthly`", "`0 0 1 * *`"],
          ["`@yearly` / `@annually`", "`0 0 1 1 *`"],
          ["`@reboot`", "Once, at every startup"]),
    note("Gotcha:", "Minute comes **first**, then hour: `15 6 * * 1` is 6:15 a.m. on Mondays, not 15:06. The third field is the day of the **month**."))

# ------------------------------------------------------------------ 13
section("13. Shell Scripting",
    h("The basics"),
    ul("Any command you can type at the prompt can go into a script.",
       "The first line, `#!/bin/bash`, is the **shebang**: it names the interpreter that runs the file.",
       "Run it with `bash myscript.sh` (needs read) or `./myscript.sh` (needs execute, after `chmod +x`)."),
    sub("if"),
    code("if [ -f /etc/passwd ]; then\n  echo \"found it\"\nfi                       # closes an if"),
    sub("for"),
    code("for name in alice bob carol; do\n  echo \"Hello, $name\"\ndone                     # closes a loop"),
    sub("case"),
    code("case $1 in\n  start) echo \"starting\" ;;\n  stop)  echo \"stopping\" ;;\n  *)     echo \"usage: $0 start|stop\" ;;\nesac                     # closes a case"),
    note("Remember:", "Spaces matter inside `[ ... ]`. Each block closes with its keyword backwards or its own word: `if` ends with `fi`, `case` with `esac`, loops with `done`."))

# ------------------------------------------------------------------ 14
section("14. Common Mix-ups",
    h("Pairs that are easy to confuse"),
    table(["Mix-up", "The difference"],
          ["`cd ..` vs `cd .`", "Up one level vs stay where you are"],
          ["`>` vs `>>`", "Replace the file vs append to it"],
          ["`rmdir` vs `rm -r`", "Empty directories only vs a directory and everything in it"],
          ["`su -` vs `sudo`", "Become root (root's password) vs run one command as root (your password)"],
          ["`start` vs `enable`", "Run now vs run at boot"],
          ["`usermod -G` vs `-aG`", "Replace the groups vs add to them"],
          ["hard vs soft link", "Another name for the same data vs a shortcut that can break"],
          ["`find` vs `locate`", "Live search vs a database that may be stale"],
          ["`head` vs `tail`", "First lines vs last lines (10 by default)"],
          ["`*` vs `?`", "Zero or more characters vs exactly one"],
          ["`{1..4}` vs `[1-4]`", "Builds four names vs matches one of four existing characters"],
          ["`ls -ltr` order", "Oldest first, newest last (the `-r` reverses newest-first)"],
          ["`bash script` vs `./script`", "Needs read permission vs needs execute permission"],
          ["`cron` fields", "Minute, hour, day of month, month, day of week, in that order"]))


def main():
    problems = []
    if len({s["name"] for s in SECTIONS}) != len(SECTIONS):
        problems.append("two sections share a name")
    for s in SECTIONS:
        if not s["blocks"]:
            problems.append("%s has no blocks" % s["name"])
        for b in s["blocks"]:
            if b["type"] == "table":
                width = len(b["headers"])
                for r in b["rows"]:
                    if len(r) != width:
                        problems.append("%s: a table row has %d cells, expected %d: %s" % (s["name"], len(r), width, r[0]))
    if problems:
        print("%d problem(s):" % len(problems))
        for x in problems:
            print("  " + x)
        return 1

    guide = {
        "title": "ITN 170 Final Review Guide",
        "description": "Everything on the final in one place, in the same order as the quiz and flashcards: navigation, "
                       "file maintenance, permissions, wildcards, monitoring, services, finding files and links, pipes "
                       "and text tools, users and sudo, vi, cron and scripting, ending with the mix-ups that cost marks.",
        "quizFile": "data/itn170-final-exam.json",
        "flashcardsFile": "data/itn170-final-flashcards.json",
        "boxFile": "data/itn170-box.json",
        "sections": SECTIONS,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(guide, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    n_blocks = sum(len(s["blocks"]) for s in SECTIONS)
    print("%d sections, %d blocks -> data/itn170-final-guide.json" % (len(SECTIONS), n_blocks))
    return 0


if __name__ == "__main__":
    sys.exit(main())
