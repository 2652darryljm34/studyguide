#!/usr/bin/env python3
"""
Builds the ITN 170 final flashcards -> data/itn170-final-flashcards.json.

    python3 tools/build_itn170_flashcards.py

One card per command or idea on the final review: the definition on the back, when to use it,
and example code. Cards are grouped into the same topics as the final exam quiz. The build
refuses to write if a card is incomplete or a term repeats (the deck remembers "known" cards
by term, so terms must be unique).
"""

import json
import os
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "itn170-final-flashcards.json")

CARDS = []


def c(topic, term, definition, use, example):
    CARDS.append({"topic": topic, "term": term, "definition": definition, "useCase": use, "example": example})


# ---------------------------------------------------------------- Navigation
T = "Navigation"
c(T, "cd", "Change directory: moves your shell into another directory. With no argument it takes you home.",
  "Move around the file system. Relative paths start from where you are; absolute paths start at /.",
  "cd /etc\ncd ~\ncd ..")
c(T, "cd .. vs cd .", "A single dot is the current directory and two dots are its parent. So cd .. goes up a level, and cd . stays put.",
  "Go up one level with ..; the single dot is handy in commands such as cp file . (copy it here).",
  "pwd        # /home/student/labs\ncd ..\npwd        # /home/student")
c(T, "pwd", "Print working directory: shows the full path of the directory you are in.",
  "Check where you are before using a relative path or deleting anything.",
  "pwd")
c(T, "ls", "Lists the files and directories in a directory.",
  "See what is here. Options change how much detail you get and in what order.",
  "ls\nls /etc")
c(T, "ls -l", "Long listing: file type and permissions, link count, owner, group, size, date and name for each entry.",
  "Check permissions and ownership.",
  "ls -l")
c(T, "ls -ltr", "A long listing (-l) sorted by modification time (-t), with the order reversed (-r), so the oldest file is first and the newest is last.",
  "The most recently changed file ends up at the bottom, next to your prompt.",
  "ls -ltr /var/log")
c(T, "whoami", "Prints the name of the account you are logged in as.",
  "Check who you are before running privileged commands.",
  "whoami")
c(T, "su -", "Switch user. With no name it switches to root, loads root's login environment, and asks for root's password.",
  "Get a root shell, or become another user with su - name. Type exit to come back.",
  "su -\nsu - bob")
c(T, "sudo", "Runs a single command with root privileges, if the sudoers configuration allows you. It asks for your own password.",
  "Do administration without staying logged in as root.",
  "sudo ls /root\nsudo systemctl restart sshd")
c(T, "sudo su", "Uses sudo to run su, which gives you a root shell. You type your own password, not root's.",
  "A quick way to become root when your account is allowed to use sudo.",
  "sudo su\nwhoami      # root")
c(T, "clear", "Clears the terminal screen.",
  "Tidy up the display. Ctrl+L does the same thing.",
  "clear")
c(T, "man", "Displays the manual page for a command: its options, syntax and examples.",
  "Look something up without leaving the terminal. Press q to quit and / to search the page.",
  "man ls\nman -k password")

# ---------------------------------------------------------------- File maintenance
T = "File Maintenance"
c(T, "cp", "Copies a file to a new name or location. With -r it copies a directory and everything in it.",
  "Make a backup or a duplicate. The original stays where it is.",
  "cp notes.txt notes.bak\ncp -r project project-backup")
c(T, "mv", "Moves a file or directory somewhere else. Moving within the same directory is how you rename.",
  "Rename or relocate files.",
  "mv old.txt new.txt\nmv report.txt ~/Documents/")
c(T, "rm", "Removes (deletes) files. There is no trash can, so deleted files are gone.",
  "Delete files you no longer need. Add -i to be asked before each one.",
  "rm draft.txt\nrm -i *.bak")
c(T, "mkdir", "Makes a new directory.",
  "Create folders. With -p it also creates any missing parent directories.",
  "mkdir projects\nmkdir -p projects/2025/reports")
c(T, "rmdir", "Removes a directory, but only if it is empty. It refuses if anything is inside.",
  "Safe cleanup of empty folders.",
  "rmdir old-notes")
c(T, "rm -r", "Removes a directory and everything inside it, working recursively.",
  "Delete a folder that is not empty, where rmdir would refuse.",
  "rm -r old-project")
c(T, "rm -rf", "Recursive (-r) and forced (-f) removal: deletes a whole tree without prompting and ignores files that do not exist.",
  "Very powerful and very dangerous. Double-check the path before pressing Enter.",
  "rm -rf build/")
c(T, "touch", "Creates an empty file if it does not exist yet, or updates its timestamp if it does.",
  "Make placeholder files quickly, especially together with brace expansion.",
  "touch notes.txt\ntouch project{1..3}")
c(T, "chmod", "Changes the permission bits (read, write, execute) of a file or directory, in symbolic or octal form.",
  "Make a script executable, or lock a file down.",
  "chmod 644 notes.txt\nchmod u+x script.sh")
c(T, "chown", "Changes the owner of a file, and optionally its group too (owner:group).",
  "Hand a file over to another user. Needs root.",
  "sudo chown alice report.txt\nsudo chown alice:staff report.txt")
c(T, "chgrp", "Changes the group that owns a file.",
  "Share files with a team without changing the owner.",
  "sudo chgrp developers app.conf")

# ---------------------------------------------------------------- Permissions
T = "Permissions"
c(T, "Octal permission values", "Each permission has a number: read is 4, write is 2, execute is 1. You add them up separately for the owner, the group and others.",
  "Convert quickly: 7 = rwx, 6 = rw-, 5 = r-x, 4 = r--, 0 = no access.",
  "rwx  r-x  r--\n 7    5    4     ->  754")
c(T, "chmod 755", "Owner rwx, group r-x, others r-x. The usual mode for programs and directories.",
  "Everyone can run it or enter it, but only the owner can change it.",
  "chmod 755 script.sh")
c(T, "chmod 644", "Owner rw-, group r--, others r--. The usual mode for ordinary files.",
  "Everyone can read it, only the owner can edit it.",
  "chmod 644 notes.txt")
c(T, "chmod 600", "Owner rw-, and no access at all for the group or others.",
  "Private files, such as SSH keys.",
  "chmod 600 ~/.ssh/id_rsa")
c(T, "chmod u+x", "Symbolic mode: u is the owner, + adds a permission, x is execute. All the other bits stay as they are.",
  "Make a script runnable without touching its other permissions. Use g or o for group or others, - to remove.",
  "chmod u+x script.sh\nchmod g-w file.txt")
c(T, "Reading ls -l permissions", "Ten characters: the file type, then rwx for the owner, the group and others. A dash means that permission is missing.",
  "Work out who can do what from a long listing.",
  "-rwxr-xr--  1 alice staff 120 notes.sh\n(file; owner rwx; group r-x; others r--)")

# ---------------------------------------------------------------- Wildcards
T = "Wildcards"
c(T, "* wildcard", "Matches zero or more characters in a file name.",
  "Act on many files at once. Note that it also matches nothing, so project* matches plain project.",
  "ls project*\nrm *.tmp")
c(T, "? wildcard", "Matches exactly one character.",
  "Match names of a fixed length: one ? is one character, two ?? are two.",
  "ls project?     # project1, projectA\nls project??    # project12")
c(T, "[ ] sets and ranges", "Matches exactly one character from the listed set or range.",
  "Pick out particular names: [aegh] is a list, [a-h] is a range.",
  "ls project[aegh]\nls project[a-h]")
c(T, "[!135] negated set", "A set starting with ! matches one character that is NOT any of those listed.",
  "Match everything except a few characters.",
  "ls project[!135]")
c(T, "Brace expansion", "The shell expands {...} lists and ranges into separate words before the command runs. It builds names; it does not search for files that exist.",
  "Create many files or directories in one command.",
  "touch project{1..4}\ntouch file{a,e,g}")

# ---------------------------------------------------------------- Viewing files
T = "Viewing Files"
c(T, "cat", "Prints a file's contents to the screen.",
  "Look at a short file, or feed a file into a pipe.",
  "cat notes.txt")
c(T, "tac", "Prints a file with the last line first. It is cat spelled backwards.",
  "Read a log from newest to oldest.",
  "tac log.txt")
c(T, "more", "Shows a file one screen at a time. Press Space for the next page.",
  "Page through a long file or a long command output.",
  "more /etc/services\nls -l /etc | more")
c(T, "less", "A pager that can also scroll backwards and search. Arrow keys or j and k move a line at a time, / searches, q quits.",
  "Read long files comfortably. Usually better than more.",
  "less /var/log/messages")
c(T, "head", "Shows the first 10 lines of a file, or as many as you ask for with -n.",
  "Peek at the start of a file.",
  "head notes.txt\nhead -n 3 notes.txt")
c(T, "tail", "Shows the last 10 lines of a file. With -f it keeps following new lines as they are added.",
  "Check the latest log entries.",
  "tail -n 5 log.txt\ntail -f /var/log/messages")
c(T, "nano", "A simple text editor that shows its key commands on screen. Ctrl+O saves and Ctrl+X exits.",
  "Quick edits without learning vi.",
  "nano notes.txt")

# ---------------------------------------------------------------- Users & system info
T = "Users & System Info"
c(T, "who", "Lists who is logged in right now, with their terminal and login time.",
  "See who else is on the system.",
  "who")
c(T, "w", "Shows who is logged in and what each person is running, plus the system load.",
  "A fuller view than who.",
  "w")
c(T, "last", "Shows the history of logins and reboots, newest first.",
  "Find out who logged in, from where, and when.",
  "last\nlast -n 5")
c(T, "finger", "Prints a short summary of users: login name, real name, terminal, idle time and login time. It may need to be installed.",
  "Look up information about a user.",
  "finger\nfinger alice")
c(T, "id", "Shows your user ID, your group ID and all the groups you belong to, or those of another user.",
  "Check group membership, for example whether you are in wheel.",
  "id\nid alice")
c(T, "date", "Displays the system date and time. As root it can also set them with -s.",
  "Check the clock, or set it before testing a scheduled job.",
  "date\nsudo date -s \"28 Mar 2023 20:05:40\"")
c(T, "uptime", "Shows how long the system has been running, how many users are logged in, and the load average.",
  "Find out when the machine last rebooted and how busy it is.",
  "uptime")
c(T, "hostname", "Shows (or sets) the name of the machine.",
  "Confirm which server you are on.",
  "hostname")
c(T, "uname", "Prints information about the kernel and operating system. -r gives the kernel release and -a gives everything.",
  "Check the kernel version.",
  "uname\nuname -r")
c(T, "which", "Shows the full path of the program that would run for a command name.",
  "Find where a command lives.",
  "which pwd")
c(T, "cal", "Displays a calendar for this month, a given month, or a whole year.",
  "Check a date quickly.",
  "cal\ncal 9 2016\ncal 2016")
c(T, "bc", "A command-line calculator for basic arithmetic.",
  "Do sums in the terminal, or pipe an expression into it.",
  "echo '2 + 3 * 4' | bc")

# ---------------------------------------------------------------- Processes & monitoring
T = "Processes & Monitoring"
c(T, "systemctl", "Controls systemd services: start, stop, restart, enable at boot, and show status. It replaced the service command in RHEL 7. Most actions need root.",
  "Start a service now, or make it start automatically at boot.",
  "sudo systemctl start httpd\nsudo systemctl enable httpd\nsystemctl status httpd")
c(T, "service", "The older command for starting and stopping services. On current RHEL it is a thin wrapper around systemctl.",
  "Recognize it in older tutorials and scripts.",
  "sudo service httpd restart")
c(T, "ps", "Lists processes. On its own it shows only your current shell; the options aux show every process.",
  "Find a process and its ID.",
  "ps\nps aux | grep sshd")
c(T, "top", "A live, updating view of processes with their CPU and memory use. Press q to quit.",
  "See what is using the machine's resources right now.",
  "top")
c(T, "kill", "Sends a signal to a process, by its ID. The default asks it to terminate; -9 forces it.",
  "Stop a stuck program. An ordinary user can only signal their own processes.",
  "kill 1234\nkill -9 1234")
c(T, "free", "Summarizes memory: total, used and free RAM, and swap. -h shows human-readable sizes.",
  "Check whether the machine is short of memory.",
  "free -h")
c(T, "df", "Reports free disk space for each mounted file system. -h shows human-readable sizes.",
  "Find out which disk is filling up.",
  "df -h")
c(T, "dmesg", "Prints the kernel's message buffer: hardware detection, driver messages, warnings and errors.",
  "Diagnose hardware or boot problems.",
  "dmesg | tail")
c(T, "iostat", "Reports CPU and disk input/output statistics. A number gives the refresh interval in seconds. It is part of the sysstat package.",
  "Watch disk activity over time.",
  "iostat 1")
c(T, "netstat", "Shows network connections, listening ports, the routing table and interface statistics. An older tool, now replaced by ss and ip.",
  "See what the machine is connected to and what it is listening on.",
  "netstat -tulpn")
c(T, "/proc/cpuinfo", "A virtual file the kernel generates that describes each CPU.",
  "Check the processor model and number of cores.",
  "cat /proc/cpuinfo")
c(T, "/proc/meminfo", "A virtual file the kernel generates that describes memory use in detail.",
  "See the numbers behind the free command.",
  "cat /proc/meminfo")

# ---------------------------------------------------------------- Finding files & links
T = "Finding Files & Links"
c(T, "find", "Searches a directory tree for files by name, type, size, owner and more. It reads the real directories each time, so it is always up to date.",
  "Locate a file when you know part of its name. The first argument is where to start.",
  "find . -name \"notes.txt\"\nfind / -name \"ifcfg-enp0s3\" 2>/dev/null")
c(T, "locate", "Finds files by name using a prebuilt database. Very fast, but only as current as the last updatedb run.",
  "A quick lookup for files that have existed for a while.",
  "locate notes.txt\nsudo updatedb")
c(T, "Hard link", "A second name for the same data. Deleting, renaming or moving the original does not affect it, and the data stays until the last name is gone.",
  "Keep a file reachable under two names within one file system.",
  "ln original.txt copy.txt")
c(T, "Soft (symbolic) link", "A small file that stores the path to its target, like a shortcut. If the target is deleted or renamed, the link breaks.",
  "Point to a file or directory somewhere else, even on another file system.",
  "ln -s /etc/hosts hostslink\nls -l hostslink")
c(T, "ln vs ln -s", "ln makes a hard link. ln -s makes a soft (symbolic) link.",
  "Pick the link type: -s when you want a shortcut that can cross file systems.",
  "ln file hardlink\nln -s file softlink")

# ---------------------------------------------------------------- Pipes & text tools
T = "Pipes & Text Tools"
c(T, "> (overwrite)", "Redirects a command's output into a file, replacing whatever was in the file.",
  "Save output. Be careful: an existing file is wiped.",
  "ls -ltr > filelist.txt")
c(T, ">> (append)", "Redirects output to the end of a file, keeping what is already there.",
  "Add to a log or list.",
  "date >> log.txt")
c(T, "| (pipe)", "Sends the output of one command to the input of the next.",
  "Chain small tools together.",
  "ls -l /etc | more\nls -l | head")
c(T, "grep", "Prints the lines that match a pattern. -c counts them, -i ignores case.",
  "Search inside files or command output.",
  "grep Cat animals\ngrep -c Cat animals")
c(T, "sort", "Sorts lines of text. -n sorts numerically, -r reverses, -k picks a column.",
  "Put output in order, and prepare it for uniq.",
  "sort -k2 animals")
c(T, "uniq", "Collapses repeated lines, but only when they are next to each other, so the input should be sorted first. -c counts them.",
  "Remove duplicates or count them.",
  "sort animals | uniq")
c(T, "sort | uniq -c", "The standard counting pipeline: sort puts identical lines together, then uniq -c counts each group.",
  "Build a frequency table of anything.",
  "awk '{print $2}' animals | sort | uniq -c")
c(T, "awk", "Processes text one line at a time, split into fields: $1 is the first field, $2 the second, and so on.",
  "Pull out a column.",
  "awk '{print $2}' animals")
c(T, "sed", "A stream editor. The common use is substitution: s/old/new/ replaces the first match on each line.",
  "Find and replace in text without opening an editor.",
  "sed 's/Cat/Feline/' animals")
c(T, "tee", "Copies its input to a file and also passes it on to the screen (or the next command).",
  "Save an intermediate result while still seeing it.",
  "grep Aves animals | tee aves.txt")
c(T, "wc", "Counts lines, words and bytes. -l counts lines only.",
  "Count how many lines or matches there are.",
  "wc -l animals\ngrep Cat animals | wc -l")

# ---------------------------------------------------------------- Users, groups & sudo
T = "Users, Groups & sudo"
c(T, "useradd", "Creates a new user account. adduser is the same command on RHEL and CentOS. New accounts are locked until a password is set.",
  "Add someone to the system.",
  "sudo useradd newuser")
c(T, "passwd", "Sets or changes a user's password. Weak passwords may be rejected by the dictionary check.",
  "Unlock a new account, or reset a password.",
  "sudo passwd newuser")
c(T, "groupadd", "Creates a new group.",
  "Set up a group before adding users to it.",
  "sudo groupadd developers")
c(T, "usermod", "Modifies an existing user account: groups, shell, home directory and more.",
  "Change a user without recreating them.",
  "sudo usermod -aG developers newuser")
c(T, "usermod -aG", "-G sets a user's supplementary groups and -a appends to them. Without -a, the user's other supplementary groups are replaced.",
  "Add a user to a group safely. Never leave out the -a.",
  "sudo usermod -aG wheel newuser")
c(T, "wheel group", "On RHEL and CentOS, members of this special group may run any command as root through sudo.",
  "The way to make an account an administrator.",
  "id newuser     # groups=...,10(wheel)")
c(T, "su - user", "Starts a login session as another user. As root you do not need their password. exit returns to your own session.",
  "Test a new account.",
  "su - newuser\nexit")
c(T, "sudo whoami", "A quick test that sudo works: it prints root, because the command ran with root's rights.",
  "Verify that a new sudo user was set up correctly.",
  "sudo whoami      # root")
c(T, "Steps to add a sudo user", "Become root, create the user, set a password, add the user to wheel, then test with su - and sudo.",
  "The complete recipe, in order.",
  "sudo su\nuseradd newuser\npasswd newuser\nusermod -aG wheel newuser\nsu - newuser\nsudo whoami")
c(T, "/etc/sudoers", "The configuration file that decides who may use sudo. Edit it with visudo, which checks the syntax. On RHEL the wheel group is granted full access.",
  "See where sudo permissions come from.",
  "sudo visudo\n%wheel  ALL=(ALL)  ALL")

# ---------------------------------------------------------------- vi
T = "vi"
c(T, "vi modes", "vi starts in command mode, where keys are commands rather than text. Press i to enter insert mode and type; Esc returns to command mode.",
  "The reason typing appears to do nothing when you first open a file.",
  "vi notes.txt\n(i) type your text (Esc)")
c(T, "i", "Enters insert mode, so what you type goes into the file.",
  "Start adding text at the cursor.",
  "i")
c(T, "Esc", "Leaves insert mode and returns to command mode.",
  "The way out of any mode.",
  "Esc")
c(T, "r", "Replaces the single character under the cursor with the next one you type.",
  "Fix one wrong letter.",
  "r")
c(T, "dd", "Deletes the current line.",
  "Remove a whole line quickly.",
  "dd")
c(T, "u", "Undoes the last change.",
  "Recover from a mistaken delete.",
  "u")
c(T, "x", "Deletes the character under the cursor.",
  "Remove a single character.",
  "x")
c(T, ":q!", "Quits without saving, throwing away any changes.",
  "Get out after a mistake.",
  ":q!")
c(T, ":wq and ZZ", "Both save the file and quit. ZZ is Shift+Z pressed twice, from command mode.",
  "Finish editing and keep your changes.",
  ":wq\nZZ")
c(T, "/ (search)", "Searches forward for a string. Press n for the next match.",
  "Find a word in a long file.",
  "/error")

# ---------------------------------------------------------------- cron
T = "cron"
c(T, "crontab -e", "Edits your personal cron table, normally in vi. Each line is one scheduled job.",
  "Schedule a command or script to run automatically.",
  "crontab -e")
c(T, "crontab -l and -r", "-l lists your scheduled jobs and -r removes all of them. As root, -u name works on another user's table.",
  "Check what is scheduled, or clear it. Be careful: -r deletes the whole table.",
  "crontab -l\ncrontab -r\nsudo crontab -u alice -l")
c(T, "Five time fields", "A cron line is: minute, hour, day of month, month, day of week, then the command. A * means every value.",
  "Read any schedule from left to right.",
  "30 16 2 * *  /path/script.sh\n# 4:30 p.m. on the 2nd of every month")
c(T, "0 3 * * *", "Minute 0, hour 3, every day, every month, every weekday: runs daily at 3:00 a.m.",
  "A typical nightly job such as a backup.",
  "0 3 * * * /root/backup.sh")
c(T, "*/30 and ranges", "*/n means every n units of that field. A range like 1-5 covers several values; in the weekday field 1-5 is Monday to Friday.",
  "Repeat often, or run only on weekdays.",
  "*/30 * * * * /path/command\n0 22 * * 1-5 /path/command")
c(T, "@daily, @hourly, @reboot", "Shortcuts for common schedules: @hourly (0 * * * *), @daily or @midnight (0 0 * * *), @weekly (0 0 * * 0), @monthly (0 0 1 * *), @yearly (0 0 1 1 *), @reboot (once at startup).",
  "Write a schedule without counting stars.",
  "@daily /path/script.sh\n@reboot /path/start.sh")

# ---------------------------------------------------------------- Shell scripting
T = "Shell Scripting"
c(T, "Shebang (#!/bin/bash)", "The first line of a script. It names the interpreter that should run the file.",
  "Tell the system which shell the script is written for.",
  "#!/bin/bash\necho \"Hello\"")
c(T, "Running a script", "bash script reads it, so it only needs read permission. ./script runs it directly, so it needs execute permission (and the shebang).",
  "Choose how to launch a script.",
  "bash myscript.sh\nchmod +x myscript.sh\n./myscript.sh")
c(T, "if statement", "Runs commands only when a test is true. The test goes in [ ] with spaces inside, and the block ends with fi.",
  "Make a decision, such as whether a file exists.",
  "if [ -f /etc/passwd ]; then\n  echo \"found it\"\nfi")
c(T, "for loop", "Repeats commands once for each value in a list, setting a variable each time. The body is closed with done.",
  "Do the same thing to several items.",
  "for name in alice bob carol; do\n  echo \"Hello, $name\"\ndone")
c(T, "case statement", "Chooses between several patterns. Each branch ends with ;; and the whole statement is closed with esac.",
  "A tidy alternative to a long chain of ifs.",
  "case $1 in\n  start) echo \"starting\" ;;\n  stop)  echo \"stopping\" ;;\n  *)     echo \"usage\" ;;\nesac")


def main():
    problems = []
    seen = set()
    for i, card in enumerate(CARDS):
        for field in ("topic", "term", "definition", "useCase", "example"):
            if not str(card.get(field, "")).strip():
                problems.append("card %d (%s): empty %s" % (i, card.get("term"), field))
        if card["term"] in seen:
            problems.append("duplicate term: %s" % card["term"])
        seen.add(card["term"])
        for field, limit in (("definition", 260), ("useCase", 180)):
            if len(card[field]) > limit:
                problems.append("%s: %s is %d characters (limit %d), too long for the card"
                                % (card["term"], field, len(card[field]), limit))
    if problems:
        print("%d problem(s):" % len(problems))
        for p in problems:
            print("  " + p)
        return 1

    deck = {"title": "ITN 170 Final Flashcards",
            "guideFile": "data/itn170-final-guide.json",
            "quizFile": "data/itn170-final-exam.json",
            "cards": CARDS}
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(deck, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    topics = []
    for card in CARDS:
        if card["topic"] not in topics:
            topics.append(card["topic"])
    print("%d cards in %d topics -> data/itn170-final-flashcards.json" % (len(CARDS), len(topics)))
    for t in topics:
        print("  %-26s %d" % (t, sum(1 for card in CARDS if card["topic"] == t)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
