/* ===========================================================================
 * The rest of the system -- chapters 3, 14, 15, 16, 17, 18 and 19.
 *
 *   man whatis apropos                       local documentation
 *   ps top pgrep pkill kill killall nice renice free uptime pstree lsof
 *   systemctl journalctl
 *   ip ss nmcli hostname hostnamectl ping dig host ssh ssh-keygen ssh-copy-id
 *   lsblk blkid df du mount umount findmnt locate updatedb
 *   date uname lscpu tar gzip which whereis crontab firewall-cmd
 *
 * The full-screen programs -- vim, nano, top's interactive mode -- cannot work
 * in a transcript, so they say so plainly and point at what does work here,
 * rather than pretending.
 * =========================================================================== */
(function () {
  'use strict';

  const S = typeof HarborShell !== 'undefined' ? HarborShell : require('./shell.js');
  const register = S.register;
  const parseArgs = S.parseArgs;
  const splitLines = S.splitLines;

  /* =========================================================================
   * Local documentation (chapter 3)
   *
   * Short pages, but real ones: enough that `man -k` finds a command by what it
   * does, and `man chmod` answers the question the exercise actually asks.
   * ======================================================================= */

  const MAN = {
    bash: [1, 'GNU Bourne-Again SHell', 'bash [options] [command_string | file]',
      ['Bash is an sh-compatible command language interpreter that executes commands',
       'read from the standard input or from a file.'], []],
    ls: [1, 'list directory contents', 'ls [OPTION]... [FILE]...',
      ['List information about the FILEs (the current directory by default).',
       'Sort entries alphabetically unless -t or -S is given.'],
      [['-l', 'use a long listing format'], ['-a', 'do not ignore entries starting with .'],
       ['-A', 'as -a but omit . and ..'], ['-h', 'with -l, print sizes like 1K 234M 2G'],
       ['-R', 'list subdirectories recursively'], ['-d', 'list directories themselves, not contents'],
       ['-t', 'sort by modification time, newest first'], ['-S', 'sort by file size, largest first'],
       ['-r', 'reverse order while sorting'], ['-i', 'print the index number of each file']]],
    cd: [1, 'change the working directory', 'cd [directory]',
      ['Change the current directory to the named one. With no argument, change to',
       'the home directory. `cd -` returns to the previous directory.'], []],
    pwd: [1, 'print name of current/working directory', 'pwd [OPTION]...',
      ['Print the full filename of the current working directory.'], []],
    cp: [1, 'copy files and directories', 'cp [OPTION]... SOURCE... DIRECTORY',
      ['Copy SOURCE to DEST, or multiple SOURCEs to DIRECTORY.'],
      [['-r, -R', 'copy directories recursively'], ['-p', 'preserve mode, ownership and timestamps'],
       ['-a', 'same as -pR: an archive copy'], ['-i', 'prompt before overwrite'],
       ['-v', 'explain what is being done']]],
    mv: [1, 'move (rename) files', 'mv [OPTION]... SOURCE... DIRECTORY',
      ['Rename SOURCE to DEST, or move SOURCE(s) into DIRECTORY.'],
      [['-i', 'prompt before overwrite'], ['-n', 'do not overwrite an existing file'],
       ['-v', 'explain what is being done']]],
    rm: [1, 'remove files or directories', 'rm [OPTION]... [FILE]...',
      ['Remove each named file. By default it does not remove directories.'],
      [['-r, -R', 'remove directories and their contents recursively'],
       ['-f', 'ignore nonexistent files, never prompt'], ['-i', 'prompt before every removal'],
       ['-d', 'remove empty directories']]],
    mkdir: [1, 'make directories', 'mkdir [OPTION]... DIRECTORY...',
      ['Create the DIRECTORY(ies), if they do not already exist.'],
      [['-p', 'make parent directories as needed, no error if existing'],
       ['-m', 'set file mode, as in chmod'], ['-v', 'print a message for each created directory']]],
    rmdir: [1, 'remove empty directories', 'rmdir [OPTION]... DIRECTORY...',
      ['Remove the DIRECTORY(ies), if they are empty.'],
      [['-p', 'remove DIRECTORY and its ancestors']]],
    touch: [1, 'change file timestamps', 'touch [OPTION]... FILE...',
      ['Update the access and modification times of each FILE to the current time.',
       'A FILE that does not exist is created empty.'],
      [['-c', 'do not create any files'], ['-d', 'parse a date string and use it'],
       ['-r', 'use this file\'s times instead of the current time']]],
    ln: [1, 'make links between files', 'ln [OPTION]... TARGET LINK_NAME',
      ['Create a link to TARGET with the name LINK_NAME. By default the link is a',
       'hard link: a second directory entry pointing at the same inode. A hard link',
       'cannot cross filesystems and cannot point at a directory.'],
      [['-s', 'make symbolic links instead of hard links'],
       ['-f', 'remove existing destination files'], ['-v', 'print the name of each linked file']]],
    cat: [1, 'concatenate files and print on the standard output', 'cat [OPTION]... [FILE]...',
      ['Concatenate FILE(s) to standard output. With no FILE, read standard input.'],
      [['-n', 'number all output lines'], ['-b', 'number nonempty output lines'],
       ['-s', 'suppress repeated empty output lines'], ['-A', 'show all non-printing characters']]],
    less: [1, 'opposite of more', 'less [options] file...',
      ['Less is a program similar to more, but it allows backward movement in the',
       'file as well as forward movement. Press q to quit, /pattern to search,',
       'Space for the next page, b for the previous one.'], []],
    head: [1, 'output the first part of files', 'head [OPTION]... [FILE]...',
      ['Print the first 10 lines of each FILE to standard output.'],
      [['-n NUM', 'print the first NUM lines instead of 10'],
       ['-c NUM', 'print the first NUM bytes']]],
    tail: [1, 'output the last part of files', 'tail [OPTION]... [FILE]...',
      ['Print the last 10 lines of each FILE to standard output.'],
      [['-n NUM', 'output the last NUM lines'], ['-n +NUM', 'output starting with line NUM'],
       ['-f', 'output appended data as the file grows']]],
    wc: [1, 'print newline, word, and byte counts for each file', 'wc [OPTION]... [FILE]...',
      ['Print newline, word and byte counts for each FILE, and a total line if more',
       'than one FILE is given.'],
      [['-l', 'print the newline counts'], ['-w', 'print the word counts'],
       ['-c', 'print the byte counts'], ['-m', 'print the character counts']]],
    grep: [1, 'print lines that match patterns', 'grep [OPTION]... PATTERNS [FILE]...',
      ['Search for PATTERNS in each FILE. PATTERNS is one or more patterns separated',
       'by newline characters, and grep prints each line that matches.'],
      [['-i', 'ignore case distinctions'], ['-v', 'select non-matching lines'],
       ['-n', 'print the line number with output lines'], ['-c', 'print only a count of matching lines'],
       ['-r', 'read all files under each directory, recursively'],
       ['-E', 'interpret PATTERNS as extended regular expressions'],
       ['-w', 'match only whole words'], ['-l', 'print only names of files with matches'],
       ['-A NUM', 'print NUM lines of trailing context'],
       ['-B NUM', 'print NUM lines of leading context']]],
    sed: [1, 'stream editor for filtering and transforming text', 'sed [OPTION]... {script} [input-file]...',
      ['sed reads the input, applies the editing script to each line in turn, and',
       'writes the result to standard output. The commonest command is s/RE/REP/,',
       'which substitutes; add g to replace every occurrence on the line.'],
      [['-n', 'suppress automatic printing of pattern space'],
       ['-e SCRIPT', 'add the script to the commands to be executed'],
       ['-i', 'edit files in place'], ['-E, -r', 'use extended regular expressions']]],
    awk: [1, 'pattern scanning and processing language', 'awk [-F fs] [-v var=value] \'program\' [file ...]',
      ['awk reads each input line, splits it into fields, and runs the program\'s',
       'pattern/action rules against it. $1 is the first field, $0 the whole record,',
       'NF the field count and NR the record number. BEGIN and END blocks run before',
       'the first line and after the last.'],
      [['-F fs', 'use fs as the input field separator'],
       ['-v var=value', 'assign a value to a variable before the program runs'],
       ['-f progfile', 'read the program from a file']]],
    sort: [1, 'sort lines of text files', 'sort [OPTION]... [FILE]...',
      ['Write the sorted concatenation of all FILE(s) to standard output.'],
      [['-n', 'compare according to string numerical value'], ['-r', 'reverse the result'],
       ['-u', 'output only the first of an equal run'], ['-k KEYDEF', 'sort via a key'],
       ['-t SEP', 'use SEP instead of whitespace as the field separator'],
       ['-h', 'compare human readable numbers (2K 1G)']]],
    uniq: [1, 'report or omit repeated lines', 'uniq [OPTION]... [INPUT [OUTPUT]]',
      ['Filter adjacent matching lines. Note that uniq only notices repeats that are',
       'next to each other, so the input is usually sorted first.'],
      [['-c', 'prefix lines by the number of occurrences'],
       ['-d', 'only print duplicate lines'], ['-u', 'only print unique lines'],
       ['-i', 'ignore differences in case']]],
    cut: [1, 'remove sections from each line of files', 'cut OPTION... [FILE]...',
      ['Print selected parts of lines from each FILE to standard output.'],
      [['-d DELIM', 'use DELIM instead of TAB as the field delimiter'],
       ['-f LIST', 'select only these fields'], ['-c LIST', 'select only these characters'],
       ['-s', 'do not print lines not containing delimiters']]],
    tr: [1, 'translate or delete characters', 'tr [OPTION]... SET1 [SET2]',
      ['Translate, squeeze, and/or delete characters from standard input, writing to',
       'standard output.'],
      [['-d', 'delete characters in SET1'], ['-s', 'squeeze repeats'],
       ['-c', 'use the complement of SET1']]],
    tee: [1, 'read from standard input and write to standard output and files',
      'tee [OPTION]... [FILE]...',
      ['Copy standard input to each FILE, and also to standard output.'],
      [['-a', 'append to the given FILEs, do not overwrite']]],
    find: [1, 'search for files in a directory hierarchy', 'find [path...] [expression]',
      ['find walks the directory tree rooted at each given path, evaluating the',
       'expression against each file it meets.'],
      [['-name PATTERN', 'base of file name matches shell pattern'],
       ['-iname PATTERN', 'like -name, case insensitive'],
       ['-type [fdl]', 'file is of this type: regular, directory, symbolic link'],
       ['-size N[ckMG]', 'file uses N units of space; +N is larger, -N is smaller'],
       ['-user NAME', 'file is owned by NAME'], ['-perm MODE', 'file permission bits are MODE'],
       ['-mtime N', 'file was modified N*24 hours ago'],
       ['-exec CMD {} \\;', 'run CMD on each file found'],
       ['-maxdepth N', 'descend at most N levels below the starting points']]],
    locate: [1, 'find files by name', 'locate [OPTION]... PATTERN...',
      ['Read one or more databases and write file names matching at least one of the',
       'patterns. The database is built by updatedb, so a file created since the last',
       'run is not yet listed.'],
      [['-i', 'ignore case'], ['-n NUM', 'limit output to NUM entries']]],
    chmod: [1, 'change file mode bits', 'chmod [OPTION]... MODE[,MODE]... FILE...',
      ['Change the permission bits of each FILE. A mode is either an octal number',
       '(0755) or a symbolic clause: who ([ugoa]) then an operator (+ - =) then the',
       'permissions ([rwxXst]). Only the file\'s owner and root may change a mode.'],
      [['-R', 'change files and directories recursively'],
       ['-v', 'output a diagnostic for every file processed'],
       ['u+x', 'add execute for the owner'], ['go-w', 'remove write for group and others'],
       ['a=r', 'set everyone to read-only'], ['g+s', 'set the setgid bit']]],
    chown: [1, 'change file owner and group', 'chown [OPTION]... [OWNER][:[GROUP]] FILE...',
      ['Change the owner and/or group of each FILE. Only root may give a file away.'],
      [['-R', 'operate on files and directories recursively'],
       ['user:group', 'set both at once'], ['user:', 'set the owner and that user\'s login group'],
       [':group', 'change only the group']]],
    chgrp: [1, 'change group ownership', 'chgrp [OPTION]... GROUP FILE...',
      ['Change the group of each FILE to GROUP. A non-root user may do this only for',
       'files they own, and only to a group they belong to.'],
      [['-R', 'operate recursively']]],
    umask: [1, 'set file mode creation mask', 'umask [-S] [mode]',
      ['The umask names the permissions that are withheld from newly created files.',
       'A new file starts from 666 and a new directory from 777; the umask bits are',
       'cleared from that. With 022, a new file is 644 and a new directory 755.'],
      [['-S', 'print the mask symbolically']]],
    useradd: [8, 'create a new user', 'useradd [options] LOGIN',
      ['Create a new user account. On Red Hat Enterprise Linux the defaults also',
       'create a home directory and a user private group of the same name.'],
      [['-u UID', 'the numerical user ID'], ['-g GROUP', 'the primary group'],
       ['-G GROUPS', 'a comma-separated list of supplementary groups'],
       ['-c COMMENT', 'the GECOS field, usually the full name'],
       ['-d HOME_DIR', 'the home directory'], ['-s SHELL', 'the login shell'],
       ['-m', 'create the home directory'], ['-M', 'do not create the home directory'],
       ['-r', 'create a system account']]],
    usermod: [8, 'modify a user account', 'usermod [options] LOGIN',
      ['Change an existing account. Note that -G replaces the whole supplementary',
       'group list; combine it with -a to add without removing.'],
      [['-aG GROUPS', 'append the user to these supplementary groups'],
       ['-G GROUPS', 'set the supplementary group list, replacing what was there'],
       ['-g GROUP', 'change the primary group'], ['-s SHELL', 'change the login shell'],
       ['-c COMMENT', 'change the comment field'], ['-L', 'lock the account'],
       ['-U', 'unlock the account'], ['-l LOGIN', 'change the login name']]],
    userdel: [8, 'delete a user account and related files', 'userdel [options] LOGIN',
      ['Delete the account. By default the home directory is left behind.'],
      [['-r', 'remove the home directory and mail spool too'],
       ['-f', 'force removal even if the user is logged in']]],
    groupadd: [8, 'create a new group', 'groupadd [options] GROUP',
      ['Create a new group with the next available GID.'],
      [['-g GID', 'the numerical group ID'], ['-r', 'create a system group']]],
    groupmod: [8, 'modify a group definition', 'groupmod [options] GROUP',
      ['Change the name or GID of an existing group.'],
      [['-n NEW_NAME', 'rename the group'], ['-g GID', 'change the group ID']]],
    groupdel: [8, 'delete a group', 'groupdel GROUP',
      ['Delete a group. A group that is some user\'s primary group cannot be removed.'], []],
    passwd: [1, 'update a user\'s authentication tokens', 'passwd [options] [LOGIN]',
      ['Change a password. An ordinary user may change only their own, and must give',
       'the current one first; root may change anyone\'s without it.'],
      [['-l', 'lock the password of the named account'],
       ['-u', 'unlock the password'], ['-d', 'delete the password'],
       ['-e', 'expire the password, forcing a change at next login'],
       ['-S', 'report the password status']]],
    chage: [1, 'change user password expiry information', 'chage [options] LOGIN',
      ['Change the number of days between permitted password changes and the date of',
       'the last change.'],
      [['-l', 'list the account aging information'], ['-d LAST_DAY', 'set the last change date'],
       ['-m MIN_DAYS', 'minimum days between changes'], ['-M MAX_DAYS', 'maximum days a password is valid'],
       ['-W WARN_DAYS', 'days of warning before expiry'], ['-E EXPIRE_DATE', 'account expiry date'],
       ['-I INACTIVE', 'days of inactivity after expiry before lock']]],
    su: [1, 'run a command with substitute user and group ID', 'su [options] [-] [user]',
      ['Become another user, root by default. A bare `su` keeps the current',
       'environment and directory; `su -` starts a full login shell, as if the target',
       'user had logged in.'],
      [['-, -l', 'start a login shell'], ['-c COMMAND', 'run a single command and return']]],
    sudo: [8, 'execute a command as another user', 'sudo [-u user] command',
      ['Run a command as root, or as the user given by -u, if the sudoers policy',
       'permits it. On Red Hat Enterprise Linux, membership of the wheel group is',
       'what usually grants this.'],
      [['-u USER', 'run the command as USER instead of root'],
       ['-i', 'run a login shell as the target user'], ['-l', 'list allowed commands'],
       ['-k', 'invalidate the cached credential']]],
    id: [1, 'print real and effective user and group IDs', 'id [OPTION]... [USER]',
      ['Print user and group information for USER, or for the current user.'],
      [['-u', 'print only the effective user ID'], ['-g', 'print only the effective group ID'],
       ['-G', 'print all group IDs'], ['-n', 'print a name instead of a number']]],
    rpm: [8, 'RPM Package Manager', 'rpm {-q|-i|-e} [options] [PACKAGE_NAME]',
      ['Query, install, verify and erase individual RPM packages. rpm works on one',
       'package file at a time and does not resolve dependencies -- that is dnf\'s job.'],
      [['-q NAME', 'query whether a package is installed'], ['-qa', 'query all installed packages'],
       ['-qi NAME', 'show package information'], ['-ql NAME', 'list the files in the package'],
       ['-qc NAME', 'list only configuration files'], ['-qd NAME', 'list only documentation files'],
       ['-qf FILE', 'name the package that owns FILE'],
       ['-qp FILE.rpm', 'query an uninstalled package file']]],
    dnf: [8, 'DNF command reference', 'dnf [options] COMMAND',
      ['Install, update and remove packages, resolving dependencies against the',
       'enabled software repositories.'],
      [['install PKG', 'install a package and everything it needs'],
       ['remove PKG', 'remove a package'], ['search TERM', 'search names and summaries'],
       ['info PKG', 'show details about a package'],
       ['list installed', 'list what is installed'],
       ['provides FILE', 'name the package that would supply FILE'],
       ['repolist', 'list the enabled software repositories'],
       ['group list', 'list package groups'], ['history', 'show past transactions'],
       ['update', 'update every installed package']]],
    flatpak: [1, 'build, install and run applications', 'flatpak [OPTION...] COMMAND',
      ['Manage sandboxed desktop applications and the runtimes they depend on.'],
      [['remotes', 'list the configured remotes'], ['remote-add NAME URL', 'add a remote'],
       ['search TERM', 'search a remote for applications'],
       ['install REMOTE APP', 'install an application'], ['list', 'list installed applications'],
       ['uninstall APP', 'remove an application'], ['run APP', 'launch an application']]],
    ps: [1, 'report a snapshot of the current processes', 'ps [options]',
      ['ps displays information about a selection of the active processes. Without',
       'options it shows only processes on the current terminal.'],
      [['aux', 'BSD syntax: every process, with the owning user'],
       ['-ef', 'UNIX syntax: every process, full format'],
       ['-u USER', 'select by effective user'], ['-o FORMAT', 'choose the output columns']]],
    top: [1, 'display Linux processes', 'top [options]',
      ['A live, ordered view of the running processes. Press k to signal a process,',
       'r to renice one, and q to quit.'], []],
    kill: [1, 'send a signal to a process', 'kill [-signal] PID...',
      ['Send a signal to a process by PID. The default signal is TERM (15), which',
       'asks a process to shut down; KILL (9) cannot be caught or ignored.'],
      [['-l', 'list the signal names'], ['-9, -KILL', 'force termination'],
       ['-15, -TERM', 'request termination (the default)'],
       ['-1, -HUP', 'hang up: many daemons reread their configuration']]],
    killall: [1, 'kill processes by name', 'killall [OPTION]... NAME...',
      ['Send a signal to every process running any of the named commands.'],
      [['-9', 'send SIGKILL'], ['-u USER', 'kill only processes owned by USER']]],
    pgrep: [1, 'look up processes based on name and other attributes', 'pgrep [options] pattern',
      ['Look through the running processes and list the PIDs that match.'],
      [['-u USER', 'match processes owned by USER'], ['-l', 'list the process name too'],
       ['-a', 'list the full command line']]],
    jobs: [1, 'list the jobs of the current shell', 'jobs [options]',
      ['List the shell\'s background and stopped jobs. Refer to one as %1, %2 and so',
       'on; fg brings one to the foreground and bg resumes one in the background.'], []],
    systemctl: [1, 'control the systemd system and service manager', 'systemctl [OPTIONS...] COMMAND [UNIT...]',
      ['Query and control the state of systemd units. "Started" and "enabled" are',
       'different things: start affects the running system now, enable affects what',
       'happens at the next boot.'],
      [['status UNIT', 'show the unit\'s runtime status'], ['start UNIT', 'start it now'],
       ['stop UNIT', 'stop it now'], ['restart UNIT', 'stop then start it'],
       ['reload UNIT', 'make it reread its configuration'],
       ['enable UNIT', 'start it automatically at boot'],
       ['disable UNIT', 'do not start it at boot'],
       ['is-active UNIT', 'report whether it is running'],
       ['is-enabled UNIT', 'report whether it starts at boot'],
       ['list-units --type=service', 'list loaded service units'],
       ['mask UNIT', 'make it impossible to start']]],
    journalctl: [1, 'query the systemd journal', 'journalctl [OPTIONS...] [MATCHES...]',
      ['Show the log entries collected by systemd-journald.'],
      [['-u UNIT', 'show entries for this unit'], ['-n N', 'show the last N entries'],
       ['-p PRIORITY', 'show entries at this priority or worse'],
       ['-f', 'follow the journal as it grows'], ['-b', 'show entries from the current boot']]],
    ip: [8, 'show / manipulate routing, devices and tunnels', 'ip [ OPTIONS ] OBJECT { COMMAND }',
      ['The ip command is the current tool for network configuration; it replaces',
       'ifconfig, route and arp.'],
      [['ip addr show', 'show addresses on every interface'],
       ['ip a s DEV', 'show addresses on one interface'],
       ['ip link show', 'show the interfaces themselves'],
       ['ip route show', 'show the routing table'], ['ip -s link show DEV', 'show statistics']]],
    nmcli: [1, 'command-line tool for controlling NetworkManager', 'nmcli [OPTIONS] OBJECT { COMMAND }',
      ['Create, show, edit and activate NetworkManager connections. A connection is',
       'the saved configuration; a device is the hardware it runs on.'],
      [['nmcli dev status', 'show the devices and their state'],
       ['nmcli con show', 'list the saved connections'],
       ['nmcli con show NAME', 'show one connection in detail'],
       ['nmcli con up NAME', 'activate a connection'],
       ['nmcli con mod NAME ipv4.addresses ADDR', 'change a setting']]],
    ssh: [1, 'OpenSSH remote login client', 'ssh [options] destination [command]',
      ['Log in to a remote machine and execute commands there.'],
      [['-l USER', 'the login name on the remote machine'],
       ['-p PORT', 'the port to connect to'], ['-i FILE', 'the identity (private key) file']]],
    'ssh-keygen': [1, 'OpenSSH authentication key utility', 'ssh-keygen [-t type] [-f file]',
      ['Generate, manage and convert authentication keys. The private key stays on',
       'your machine; the public key is what you copy to the server.'],
      [['-t TYPE', 'the key type: rsa, ecdsa or ed25519'],
       ['-f FILE', 'the file the key is written to'],
       ['-N PHRASE', 'the passphrase protecting the private key'],
       ['-b BITS', 'the number of bits in the key']]],
    'ssh-copy-id': [1, 'install your public key on a remote machine',
      'ssh-copy-id [-i keyfile] [user@]hostname',
      ['Append your public key to the remote account\'s ~/.ssh/authorized_keys, so',
       'that key-based authentication works from then on.'],
      [['-i FILE', 'use this identity file']]],
    lsblk: [8, 'list block devices', 'lsblk [options] [device...]',
      ['List information about the available block devices in a tree.'],
      [['-f', 'show the filesystem type, label and UUID'],
       ['-p', 'print full device paths']]],
    blkid: [8, 'locate/print block device attributes', 'blkid [options] [device...]',
      ['Print the UUID, label and filesystem type of each block device.'], []],
    mount: [8, 'mount a filesystem', 'mount [-t type] device dir',
      ['Attach the filesystem on device to the directory dir. With no arguments it',
       'lists what is currently mounted.'],
      [['-t TYPE', 'the filesystem type'], ['-o OPTIONS', 'mount options, comma separated'],
       ['-a', 'mount everything in /etc/fstab']]],
    umount: [8, 'unmount filesystems', 'umount [options] {directory|device}',
      ['Detach a mounted filesystem. It fails while any process is using it, which',
       'is what lsof and fuser are for.'], []],
    df: [1, 'report file system space usage', 'df [OPTION]... [FILE]...',
      ['Show how much space each mounted filesystem has, and how much is free.'],
      [['-h', 'print sizes in a human readable form'], ['-T', 'print the filesystem type'],
       ['-i', 'report inode usage instead of block usage']]],
    du: [1, 'estimate file space usage', 'du [OPTION]... [FILE]...',
      ['Summarize the space used by each file, recursively for directories.'],
      [['-h', 'print sizes in a human readable form'],
       ['-s', 'display only a total for each argument'],
       ['-a', 'count files as well as directories']]],
    tar: [1, 'an archiving utility', 'tar [OPTION...] [FILE]...',
      ['Create, list and extract archives.'],
      [['-c', 'create a new archive'], ['-x', 'extract files from an archive'],
       ['-t', 'list the contents of an archive'], ['-f FILE', 'use this archive file'],
       ['-v', 'verbosely list the files processed'], ['-z', 'filter through gzip']]],
    date: [1, 'print or set the system date and time', 'date [OPTION]... [+FORMAT]',
      ['Display the current time in the given FORMAT.'],
      [['+%Y-%m-%d', 'a numeric date'], ['-u', 'print Coordinated Universal Time']]],
    man: [1, 'an interface to the system reference manuals', 'man [section] page',
      ['Display the manual page for a command. Pages are grouped into numbered',
       'sections: 1 is user commands, 5 is file formats and configuration files, and',
       '8 is system administration commands. When a name appears in more than one',
       'section, give the number: `man 5 passwd` is the file, `man 1 passwd` the',
       'command.'],
      [['-k TERM', 'search the short descriptions, like apropos'],
       ['-f NAME', 'show the short description, like whatis'],
       ['SECTION NAME', 'show the page from that section']]],
    echo: [1, 'display a line of text', 'echo [SHORT-OPTION]... [STRING]...',
      ['Write the arguments to standard output, separated by spaces.'],
      [['-n', 'do not output the trailing newline'],
       ['-e', 'enable interpretation of backslash escapes']]],
    vim: [1, 'Vi IMproved, a programmer\'s text editor', 'vim [options] [file ..]',
      ['A modal editor. It starts in command mode: i enters insert mode, Esc returns',
       'to command mode, and from there :w writes, :q quits, :wq does both and :q!',
       'quits discarding changes. In command mode dd deletes a line, yy copies one,',
       'p pastes, and /text searches.'], []],
    history: [1, 'display or manipulate the history list', 'history [n]',
      ['Show the command history. !n repeats command number n, !! repeats the',
       'previous command, and !string repeats the last command starting with string.'], []],
    hostname: [1, 'show or set the system\'s host name', 'hostname [name]',
      ['Print the current host name. Setting it permanently is hostnamectl\'s job.'], []]
  };

  const MAN_ALIASES = {
    egrep: 'grep', fgrep: 'grep', gawk: 'awk', vi: 'vim', yum: 'dnf',
    more: 'less', 'dnf-3': 'dnf', bg: 'jobs', fg: 'jobs'
  };

  function manPage(name) {
    const key = MAN_ALIASES[name] || name;
    return MAN[key] ? { name: key, page: MAN[key] } : null;
  }

  register('man', function (ctx) {
    const args = ctx.args.slice();
    let mode = null;
    while (args.length && args[0].charAt(0) === '-') {
      const a = args.shift();
      if (a === '-k' || a === '--apropos') mode = 'k';
      else if (a === '-f' || a === '--whatis') mode = 'f';
      else if (a === '-a' || a === '--all') continue;
    }
    if (!args.length) {
      ctx.errln('What manual page do you want?');
      ctx.errln('For example, try \'man man\'.');
      return 1;
    }

    if (mode === 'k') return apropos(ctx, args.join(' '));
    if (mode === 'f') return whatis(ctx, args);

    // `man 5 passwd` -- a leading number is a section, not a page name.
    let wantSection = null;
    if (/^\d$/.test(args[0])) wantSection = parseInt(args.shift(), 10);
    const name = args[0];

    // /etc/passwd, /etc/shadow and /etc/group each have a section 5 page.
    if (wantSection === 5 && (name === 'passwd' || name === 'group' || name === 'shadow')) {
      return fileFormatPage(ctx, name);
    }

    // The real page, if the harvested bundle has arrived. It is fetched in the
    // background after the terminal is up (see assets/man.js), so the table
    // below answers instantly in the moment before it lands and on any page
    // that never loads it at all.
    // A man page arrives with its package, and a package you have not
    // installed has not put its documentation on the disk either. `man tree`
    // before `dnf install tree` finds nothing on a real machine, and finding
    // nothing here too is what makes the pair of them teach anything.
    const real = HarborShell.manPages && HarborShell.manPages[name];
    const pageInstalled = real && (!real.package || ctx.m.packages.installed.some(
      function (p) { return p.name === real.package; }));
    if (real && pageInstalled &&
        (wantSection === null || String(wantSection) === String(real.section))) {
      ctx.out(real.text);
      if (real.package) {
        ctx.outln('');
        ctx.outln('THIS PAGE');
        ctx.outln('       From the ' + real.package + ' package' +
                  (real.license ? ', licensed ' + real.license : '') + '.');
        ctx.outln('       Reproduced from Red Hat Enterprise Linux 9 for study use.');
      }
      return 0;
    }

    const found = manPage(name);
    if (!found) {
      ctx.errln('No manual entry for ' + name);
      return 16;
    }
    const [section, summary, synopsis, description, options] = found.page;
    if (wantSection !== null && wantSection !== section) {
      ctx.errln('No manual entry for ' + name + ' in section ' + wantSection);
      return 16;
    }

    const title = found.name.toUpperCase() + '(' + section + ')';
    const banner = section === 8 ? 'System Administration Utilities' : 'User Commands';
    ctx.outln(title + ' '.repeat(Math.max(1, 30 - title.length)) + banner +
      ' '.repeat(Math.max(1, 30 - banner.length)) + title);
    ctx.outln('');
    ctx.outln('NAME');
    ctx.outln('       ' + found.name + ' - ' + summary);
    ctx.outln('');
    ctx.outln('SYNOPSIS');
    ctx.outln('       ' + synopsis);
    ctx.outln('');
    ctx.outln('DESCRIPTION');
    description.forEach(function (l) { ctx.outln('       ' + l); });
    if (options && options.length) {
      ctx.outln('');
      ctx.outln('OPTIONS');
      options.forEach(function (o) {
        ctx.outln('       ' + o[0]);
        ctx.outln('              ' + o[1]);
      });
    }
    ctx.outln('');
    ctx.outln('SEE ALSO');
    ctx.outln('       The full documentation is at ' +
      'https://access.redhat.com/documentation/red_hat_enterprise_linux/9/');
    return 0;
  });

  function fileFormatPage(ctx, name) {
    const pages = {
      passwd: ['password file',
        ['/etc/passwd holds one line per account, with seven colon-separated fields:',
         '',
         '       name:password:UID:GID:GECOS:home directory:login shell',
         '',
         'The password field is an x, meaning the real hash lives in /etc/shadow.',
         'A login shell of /sbin/nologin denies interactive logins.']],
      shadow: ['shadowed password file',
        ['/etc/shadow holds the password hashes and the aging policy, one line per',
         'account, readable only by root:',
         '',
         '       name:hash:last change:min:max:warn:inactive:expire:reserved',
         '',
         'Dates are counted in days since 1 January 1970. A ! or * at the start of',
         'the hash field means the password is locked.']],
      group: ['group file',
        ['/etc/group holds one line per group, with four colon-separated fields:',
         '',
         '       name:password:GID:member list',
         '',
         'The member list names the users for whom this is a *supplementary* group.',
         'A user whose primary group this is does not appear in that list -- their',
         'membership is recorded by the GID field of their /etc/passwd line.']]
    };
    const [summary, body] = pages[name];
    const title = name.toUpperCase() + '(5)';
    ctx.outln(title + ' '.repeat(28) + 'File Formats and Conversions' + ' '.repeat(6) + title);
    ctx.outln('');
    ctx.outln('NAME');
    ctx.outln('       ' + name + ' - ' + summary);
    ctx.outln('');
    ctx.outln('DESCRIPTION');
    body.forEach(function (l) { ctx.outln(l === '' ? '' : '       ' + l); });
    return 0;
  }

  function whatis(ctx, names) {
    let any = false;
    names.forEach(function (n) {
      const found = manPage(n);
      if (!found) {
        ctx.outln(n + ': nothing appropriate.');
        ctx.status = 1;
        return;
      }
      any = true;
      ctx.outln((found.name + ' (' + found.page[0] + ')').padEnd(24) + '- ' + found.page[1]);
    });
    return any ? 0 : 1;
  }

  function apropos(ctx, term) {
    const needle = String(term).toLowerCase();
    const hits = Object.keys(MAN).filter(function (k) {
      const page = MAN[k];
      const haystack = (k + ' ' + page[1] + ' ' + page[3].join(' ') + ' ' +
        (page[4] || []).map(function (o) { return o[0] + ' ' + o[1]; }).join(' '))
        .toLowerCase();
      return haystack.indexOf(needle) !== -1;
    }).sort();
    if (!hits.length) {
      ctx.errln(term + ': nothing appropriate.');
      return 16;
    }
    hits.forEach(function (k) {
      ctx.outln((k + ' (' + MAN[k][0] + ')').padEnd(24) + '- ' + MAN[k][1]);
    });
    return 0;
  }

  register('whatis', function (ctx) { return whatis(ctx, ctx.args); });
  register('apropos', function (ctx) { return apropos(ctx, ctx.args.join(' ')); });
  register('mandb', function (ctx) {
    ctx.outln('Processing manual pages under /usr/share/man...');
    ctx.outln('0 man subdirectories contained newer manual pages.');
    return 0;
  });

  /*
   * nano really opens. The shell hands the page an `editor` state -- the file's
   * path and its current contents -- and the page draws the editor and calls
   * sh.saveBuffer() when the learner writes it out. Permissions are the
   * machine's, not the editor's, so a read-only file fails to save here the
   * same way it would on a real system.
   */
  register('nano', function (ctx) {
    if (!ctx.sh.editorEnabled) return noEditor(ctx);

    const args = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (args.length > 1) {
      ctx.errln('nano: this practice terminal opens one file at a time.');
      return 1;
    }

    const shown = args[0] || '';
    if (!shown) {
      ctx.editor = { name: 'nano', path: '', label: 'New Buffer', content: '', exists: false };
      return 0;
    }

    let found = null;
    try {
      found = ctx.sh.resolve(shown);
    } catch (err) {
      if (!err.isFsError || err.code !== 'ENOENT') {
        ctx.errln('nano: ' + shown + ': ' + err.message);
        return 1;
      }
    }

    if (found) {
      if (found.node.type === 'dir') {
        ctx.errln('nano: ' + shown + ': Is a directory');
        return 1;
      }
      if (!ctx.m.canRead(found.node, ctx.sh.user)) {
        ctx.errln('nano: ' + shown + ': Permission denied');
        return 1;
      }
      ctx.editor = {
        name: 'nano',
        path: shown,
        label: shown,
        content: ctx.m.read(found.node),
        exists: true,
        writable: ctx.m.canWrite(found.node, ctx.sh.user)
      };
      return 0;
    }

    // A name that does not exist yet is nano's "New File" case -- but only if
    // the directory it would go in is actually reachable.
    try {
      ctx.sh.m.resolveParent(shown, { cwd: ctx.sh.cwd, user: ctx.sh.user });
    } catch (err) {
      ctx.errln('nano: ' + shown + ': ' + err.message);
      return 1;
    }
    ctx.editor = {
      name: 'nano', path: shown, label: shown,
      content: '', exists: false, writable: true
    };
    return 0;
  });

  function noEditor(ctx) {
    ctx.errln(ctx.name + ': a full-screen editor cannot run here.');
    ctx.errln("To create or change a file, use 'echo text > file', " +
      "'cat > file' with a heredoc,");
    ctx.errln("'sed -i' or 'tee'. nano does open in the Practice Terminal and in the labs.");
    return 1;
  }

  register('vim vi', function (ctx) {
    ctx.errln(ctx.name + ': vim cannot run in this practice terminal.');
    ctx.errln("Use 'nano' to edit a file here. The study guide covers vim's own " +
      'modes and keystrokes,');
    ctx.errln('which you will need on a real system where vim is the editor that is always present.');
    return 1;
  });

  /* =========================================================================
   * Processes (chapter 15)
   * ======================================================================= */

  /** ps aux reports cumulative CPU time as minutes:seconds. */
  function cpuTime(hms) {
    const parts = String(hms).split(':').map(Number);
    return (parts[0] * 60 + parts[1]) + ':' + String(parts[2]).padStart(2, '0');
  }

  function psRows(m) {
    return m.processes.slice().sort(function (a, b) { return a.pid - b.pid; });
  }

  register('ps', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const raw = ctx.args.join(' ');
    const bsd = /(^|\s)-?[aux]*a[aux]*(\s|$)/.test(raw) || /\baux\b/.test(raw);
    const everything = /\ba\b|aux|-e|-A/.test(raw) || raw.indexOf('a') !== -1 && raw.indexOf('-') === -1;
    const full = /-f|-F|u|aux/.test(raw);
    const forest = /--forest|-H|f\b/.test(raw);

    const parsed = parseArgs(ctx, { bool: 'e A f F u x a H l', value: 'o p U C' });
    const fl = parsed ? parsed.flags : {};
    const userFilter = (function () {
      const m2 = /-u\s+(\S+)/.exec(raw);
      return m2 ? m2[1] : null;
    })();

    let rows = psRows(m);
    if (userFilter) {
      rows = rows.filter(function (p) { return p.user === userFilter; });
    } else if (!everything && !bsd) {
      rows = rows.filter(function (p) { return p.tty === 'pts/0'; });
    }

    if (fl.o !== undefined) {
      const cols = String(fl.o).split(',');
      ctx.outln(cols.map(function (c) { return c.toUpperCase().padEnd(8); }).join('').trimEnd());
      rows.forEach(function (p) {
        ctx.outln(cols.map(function (c) {
          const v = { pid: p.pid, ppid: p.ppid, user: p.user, comm: p.cmd.split(' ')[0]
            .replace(/^.*\//, ''), cmd: p.cmd, args: p.cmd, stat: p.state, tty: p.tty,
            '%cpu': p.cpu, '%mem': p.mem, rss: p.rss, etime: p.time }[c.toLowerCase()];
          return String(v === undefined ? '-' : v).padEnd(8);
        }).join('').trimEnd());
      });
      return 0;
    }

    if (/aux/.test(raw) || (bsd && /u/.test(raw))) {
      ctx.outln('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND');
      rows.forEach(function (p) {
        ctx.outln(p.user.padEnd(10) + String(p.pid).padStart(6) + ' ' +
          p.cpu.toFixed(1).padStart(4) + ' ' + p.mem.toFixed(1).padStart(4) + ' ' +
          String(p.rss * 4).padStart(6) + ' ' + String(p.rss).padStart(5) + ' ' +
          p.tty.padEnd(8) + ' ' + p.state.padEnd(4) + ' ' + p.start.padStart(5) + ' ' +
          cpuTime(p.time).padStart(5) + ' ' + p.cmd);
      });
      return 0;
    }

    if (/-e.*f|-f.*-e|-ef/.test(raw) || (fl.e && fl.f)) {
      ctx.outln('UID          PID    PPID  C STIME TTY          TIME CMD');
      rows.forEach(function (p) {
        ctx.outln(p.user.padEnd(12) + String(p.pid).padStart(5) + ' ' +
          String(p.ppid).padStart(7) + '  0 ' + p.start.padStart(5) + ' ' +
          p.tty.padEnd(12) + ' ' + p.time + ' ' + p.cmd);
      });
      return 0;
    }

    ctx.outln('    PID TTY          TIME CMD');
    rows.forEach(function (p) {
      ctx.outln(String(p.pid).padStart(7) + ' ' + p.tty.padEnd(12) + ' ' + p.time + ' ' +
        p.cmd.split(' ')[0].replace(/^.*\//, '').replace(/^-/, ''));
    });
    return 0;
  });

  register('pstree', function (ctx) {
    const m = ctx.m;
    const byParent = {};
    m.processes.forEach(function (p) {
      (byParent[p.ppid] = byParent[p.ppid] || []).push(p);
    });
    function name(p) {
      return p.cmd.split(' ')[0].replace(/^.*\//, '').replace(/[[\]-]/g, '');
    }
    (function walk(pid, prefix) {
      (byParent[pid] || []).forEach(function (p, i, all) {
        const last = i === all.length - 1;
        ctx.outln(prefix + (prefix ? (last ? '`-' : '|-') : '') + name(p));
        walk(p.pid, prefix + (prefix ? (last ? '  ' : '| ') : '  '));
      });
    })(0, '');
    return 0;
  });

  register('top', function (ctx) {
    const m = ctx.m;
    if (ctx.args.indexOf('-b') === -1 && ctx.sh.interactive) {
      ctx.errln("top: this practice terminal cannot run top's full-screen display.");
      ctx.errln('Showing a single snapshot instead, the way `top -b -n 1` would.');
    }
    ctx.outln('top - ' + m.formatClock(m.now) + ':00 up  6:20,  1 user,  ' +
      'load average: 0.00, 0.01, 0.05');
    ctx.outln('Tasks: ' + String(m.processes.length).padStart(3) + ' total,   1 running, ' +
      String(m.processes.length - 1).padStart(3) + ' sleeping,   0 stopped,   0 zombie');
    ctx.outln('%Cpu(s):  0.3 us,  0.3 sy,  0.0 ni, 99.3 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st');
    ctx.outln('MiB Mem :   3746.7 total,   2361.4 free,    612.3 used,    773.0 buff/cache');
    ctx.outln('MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   2835.6 avail Mem');
    ctx.outln('');
    ctx.outln('    PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND');
    psRows(m).slice().sort(function (a, b) { return b.cpu - a.cpu || b.rss - a.rss; })
      .slice(0, 15).forEach(function (p) {
        ctx.outln(String(p.pid).padStart(7) + ' ' + p.user.padEnd(9) + '20   0 ' +
          String(p.rss * 4).padStart(7) + ' ' + String(p.rss).padStart(6) + ' ' +
          String(Math.round(p.rss / 3)).padStart(6) + ' ' + p.state.charAt(0) + ' ' +
          p.cpu.toFixed(1).padStart(5) + ' ' + p.mem.toFixed(1).padStart(5) + '   ' +
          p.time.slice(3) + ' ' + p.cmd.split(' ')[0].replace(/^.*\//, ''));
      });
    return 0;
  });

  const SIGNALS = { 1: 'HUP', 2: 'INT', 3: 'QUIT', 9: 'KILL', 15: 'TERM',
                    18: 'CONT', 19: 'STOP', 20: 'TSTP' };

  register('kill', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.slice();
    if (args[0] === '-l' || args[0] === '--list') {
      ctx.outln(' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 4) SIGILL\t 5) SIGTRAP');
      ctx.outln(' 6) SIGABRT\t 7) SIGBUS\t 8) SIGFPE\t 9) SIGKILL\t10) SIGUSR1');
      ctx.outln('11) SIGSEGV\t12) SIGUSR2\t13) SIGPIPE\t14) SIGALRM\t15) SIGTERM');
      ctx.outln('16) SIGSTKFLT\t17) SIGCHLD\t18) SIGCONT\t19) SIGSTOP\t20) SIGTSTP');
      return 0;
    }
    let signal = 15;
    while (args.length && args[0].charAt(0) === '-') {
      const a = args.shift().slice(1).replace(/^-/, '').replace(/^SIG/i, '');
      if (a === 's') { continue; }
      if (/^\d+$/.test(a)) signal = parseInt(a, 10);
      else {
        const num = Object.keys(SIGNALS).find(function (k) {
          return SIGNALS[k] === a.toUpperCase();
        });
        if (num) signal = parseInt(num, 10);
      }
    }
    if (!args.length) return ctx.usage('usage: kill [-s sigspec | -n signum | -sigspec] pid');

    args.forEach(function (spec) {
      if (spec.charAt(0) === '%') {
        const job = m.jobs.find(function (j) { return j.id === parseInt(spec.slice(1), 10); });
        if (!job) { ctx.errln('kill: ' + spec + ': no such job'); ctx.status = 1; return; }
        ctx.errln('[' + job.id + ']+  Terminated              ' + job.cmd);
        m.killPid(job.pid);
        return;
      }
      const pid = parseInt(spec, 10);
      const proc = m.processes.find(function (p) { return p.pid === pid; });
      if (!proc) {
        ctx.errln('kill: (' + pid + ') - No such process');
        ctx.status = 1;
        return;
      }
      if (sh.user.uid !== 0 && proc.user !== sh.user.name) {
        ctx.errln('kill: (' + pid + ') - Operation not permitted');
        ctx.status = 1;
        return;
      }
      if (signal === 19 || signal === 20) {
        proc.state = 'T';
        const job = m.jobs.find(function (j) { return j.pid === pid; });
        if (job) job.state = 'Stopped';
        return;
      }
      if (signal === 18) {
        proc.state = 'S';
        const job = m.jobs.find(function (j) { return j.pid === pid; });
        if (job) job.state = 'Running';
        return;
      }
      m.killPid(pid);
    });
    return ctx.status;
  });

  register('killall pkill', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.slice();
    let userFilter = null;
    const names = [];
    while (args.length) {
      const a = args.shift();
      if (a === '-u') { userFilter = args.shift(); continue; }
      if (a.charAt(0) === '-') continue;
      names.push(a);
    }
    let hit = 0;
    m.processes.slice().forEach(function (p) {
      const base = p.cmd.split(' ')[0].replace(/^.*\//, '').replace(/^[-[]|]$/g, '');
      const matches = names.length
        ? names.some(function (n) {
            return ctx.name === 'pkill' ? base.indexOf(n) !== -1 : base === n;
          })
        : false;
      if (!matches) return;
      if (userFilter && p.user !== userFilter) return;
      if (sh.user.uid !== 0 && p.user !== sh.user.name) return;
      m.killPid(p.pid);
      hit++;
    });
    if (!hit) {
      if (ctx.name === 'killall') ctx.errln(names[0] + ': no process found');
      return 1;
    }
    return 0;
  });

  register('pgrep', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'l a c x', value: 'u' });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const pattern = parsed.operands[0];
    let hits = m.processes.filter(function (p) {
      const base = p.cmd.split(' ')[0].replace(/^.*\//, '');
      if (parsed.flags.u && p.user !== parsed.flags.u) return false;
      if (!pattern) return true;
      return parsed.flags.x ? base === pattern : base.indexOf(pattern) !== -1;
    });
    if (parsed.flags.c) { ctx.outln(String(hits.length)); return hits.length ? 0 : 1; }
    hits.forEach(function (p) {
      if (parsed.flags.a) ctx.outln(p.pid + ' ' + p.cmd);
      else if (parsed.flags.l) ctx.outln(p.pid + ' ' + p.cmd.split(' ')[0].replace(/^.*\//, ''));
      else ctx.outln(String(p.pid));
    });
    return hits.length ? 0 : 1;
  });

  register('nice renice', function (ctx) {
    if (ctx.name === 'renice') { ctx.outln('renice: applied'); return 0; }
    const rest = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!rest.length) { ctx.outln('0'); return 0; }
    const r = ctx.sh.run(rest.join(' '));
    ctx.out(r.stdout);
    if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
    return r.status;
  });

  register('free', function (ctx) {
    const human = ctx.args.some(function (a) { return a === '-h' || a === '--human'; });
    if (human) {
      ctx.outln('               total        used        free      shared  buff/cache   available');
      ctx.outln('Mem:           3.7Gi       612Mi       2.3Gi        11Mi       773Mi       2.8Gi');
      ctx.outln('Swap:          2.0Gi          0B       2.0Gi');
    } else {
      ctx.outln('               total        used        free      shared  buff/cache   available');
      ctx.outln('Mem:         3836584      627024     2418112       11264      791448     2903648');
      ctx.outln('Swap:        2097148           0     2097148');
    }
    return 0;
  });

  register('uptime', function (ctx) {
    ctx.outln(' ' + ctx.m.formatClock(ctx.m.now) +
      ':00 up  6:20,  1 user,  load average: 0.00, 0.01, 0.05');
    return 0;
  });

  register('lsof', function (ctx) {
    ctx.outln('COMMAND    PID    USER   FD   TYPE DEVICE SIZE/OFF   NODE NAME');
    ctx.m.processes.slice(0, 8).forEach(function (p) {
      ctx.outln((p.cmd.split(' ')[0].replace(/^.*\//, '').slice(0, 9)).padEnd(10) +
        String(p.pid).padStart(6) + ' ' + p.user.padStart(7) + '  cwd    DIR  253,0     4096      2 /');
    });
    return 0;
  });

  register('watch pmap vmstat', function (ctx) {
    if (ctx.name === 'watch') {
      const r = ctx.sh.run(ctx.args.filter(function (a) { return a.charAt(0) !== '-'; }).join(' '));
      ctx.out(r.stdout);
      if (r.stderr) ctx.errln(r.stderr.replace(/\n$/, ''));
      ctx.errln('watch: showing one pass; this terminal cannot repeat on a timer');
      return r.status;
    }
    ctx.errln(ctx.name + ': not available in this practice terminal');
    return 1;
  });

  /* =========================================================================
   * Services (chapter 16)
   * ======================================================================= */

  register('systemctl', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.filter(function (a) {
      return a !== '--no-pager' && a !== '-l' && a !== '--full';
    });
    const typeFilter = (function () {
      const t = args.find(function (a) { return a.indexOf('--type=') === 0; });
      return t ? t.split('=')[1] : null;
    })();
    const rest = args.filter(function (a) { return a.charAt(0) !== '-'; });
    const sub = rest.shift();
    const unitName = rest[0];

    function unit(name) {
      const s = m.serviceByName(name);
      if (!s) {
        ctx.errln('Unit ' + String(name).replace(/(\.service)?$/, '.service') + ' could not be found.');
        ctx.status = 4;
        return null;
      }
      return s;
    }

    function mustBeRoot() {
      if (sh.user.uid === 0) return false;
      ctx.errln('Failed to ' + sub + ' ' + unitName + '.service: Access denied');
      ctx.errln('See system logs and \'systemctl status ' + unitName + '.service\' for details.');
      ctx.status = 1;
      return true;
    }

    switch (sub) {
      case undefined:
      case 'list-units': {
        ctx.outln('  UNIT'.padEnd(34) + 'LOAD   ACTIVE SUB     DESCRIPTION');
        m.services.forEach(function (s) {
          if (typeFilter && typeFilter !== 'service') return;
          ctx.outln('  ' + (s.name + '.service').padEnd(32) + 'loaded ' +
            (s.state === 'running' ? 'active' : 'inactive') + ' ' +
            (s.state === 'running' ? 'running' : 'dead').padEnd(7) + ' ' + s.description);
        });
        ctx.outln('');
        ctx.outln('LOAD   = Reflects whether the unit definition was properly loaded.');
        ctx.outln('ACTIVE = The high-level unit activation state.');
        ctx.outln('SUB    = The low-level unit activation state.');
        ctx.outln('');
        ctx.outln(m.services.length + ' loaded units listed.');
        return 0;
      }

      case 'list-unit-files': {
        ctx.outln('UNIT FILE'.padEnd(34) + 'STATE           PRESET');
        m.services.forEach(function (s) {
          ctx.outln((s.name + '.service').padEnd(34) +
            (s.enabled ? 'enabled' : 'disabled').padEnd(16) +
            (s.enabled ? 'enabled' : 'disabled'));
        });
        ctx.outln('');
        ctx.outln(m.services.length + ' unit files listed.');
        return 0;
      }

      case 'status': {
        if (!unitName) {
          ctx.outln('● ' + m.shortHostname);
          ctx.outln('    State: running');
          ctx.outln('     Jobs: 0 queued');
          ctx.outln('   Failed: 0 units');
          return 0;
        }
        const s = unit(unitName);
        if (!s) return 4;
        const active = s.state === 'running';
        ctx.outln((active ? '●' : '○') + ' ' + s.name + '.service - ' + s.description);
        ctx.outln('     Loaded: loaded (/usr/lib/systemd/system/' + s.name + '.service; ' +
          (s.enabled ? 'enabled' : 'disabled') + '; preset: ' +
          (s.enabled ? 'enabled' : 'disabled') + ')');
        ctx.outln('     Active: ' + (active
          ? 'active (running) since ' + m.formatStamp(m.bootTime) + '; 6h ago'
          : 'inactive (dead)'));
        if (active) {
          ctx.outln('   Main PID: ' + s.pid + ' (' + s.name + ')');
          ctx.outln('      Tasks: 1 (limit: 22873)');
          ctx.outln('     Memory: 5.8M');
          ctx.outln('        CPU: 128ms');
          ctx.outln('     CGroup: /system.slice/' + s.name + '.service');
          ctx.outln('             └─' + s.pid + ' /usr/sbin/' + s.name);
        }
        ctx.outln('');
        m.journal.filter(function (j) { return j.unit === s.name || j.unit === 'systemd'; })
          .slice(0, 3).forEach(function (j) {
            ctx.outln(j.time + ' ' + m.shortHostname + ' ' + j.unit +
              (j.pid ? '[' + j.pid + ']' : '') + ': ' + j.message);
          });
        return active ? 0 : 3;
      }

      case 'is-active': {
        const s = m.serviceByName(unitName);
        ctx.outln(s && s.state === 'running' ? 'active' : 'inactive');
        return s && s.state === 'running' ? 0 : 3;
      }

      case 'is-enabled': {
        const s = m.serviceByName(unitName);
        if (!s) { ctx.errln('Failed to get unit file state for ' + unitName + '.service: ' +
          'No such file or directory'); return 1; }
        ctx.outln(s.enabled ? 'enabled' : 'disabled');
        return s.enabled ? 0 : 1;
      }

      case 'start': case 'stop': case 'restart': case 'reload': case 'try-restart': {
        if (mustBeRoot()) return 1;
        const s = unit(unitName);
        if (!s) return 4;
        if (sub === 'stop') { s.state = 'stopped'; s.pid = null; m.killPid(s.pid); }
        else if (sub === 'reload') {
          if (s.state !== 'running') {
            ctx.errln('Failed to reload ' + s.name + '.service: Unit is not active.');
            return 1;
          }
        } else {
          s.state = 'running';
          if (!s.pid) s.pid = m.nextPid++;
        }
        return 0;
      }

      case 'enable': case 'disable': {
        if (mustBeRoot()) return 1;
        const s = unit(unitName);
        if (!s) return 4;
        s.enabled = sub === 'enable';
        if (sub === 'enable') {
          ctx.errln('Created symlink /etc/systemd/system/multi-user.target.wants/' +
            s.name + '.service → /usr/lib/systemd/system/' + s.name + '.service.');
          if (rest.indexOf('--now') !== -1 || args.indexOf('--now') !== -1) {
            s.state = 'running';
            if (!s.pid) s.pid = m.nextPid++;
          }
        } else {
          ctx.errln('Removed "/etc/systemd/system/multi-user.target.wants/' +
            s.name + '.service".');
          if (args.indexOf('--now') !== -1) { s.state = 'stopped'; s.pid = null; }
        }
        return 0;
      }

      case 'mask': case 'unmask': {
        if (mustBeRoot()) return 1;
        const s = unit(unitName);
        if (!s) return 4;
        s.masked = sub === 'mask';
        if (sub === 'mask') {
          s.enabled = false;
          ctx.errln('Created symlink /etc/systemd/system/' + s.name + '.service → /dev/null.');
        } else {
          ctx.errln('Removed "/etc/systemd/system/' + s.name + '.service".');
        }
        return 0;
      }

      case 'daemon-reload':
        if (mustBeRoot()) return 1;
        return 0;

      case 'list-dependencies': {
        const s = unit(unitName);
        if (!s) return 4;
        ctx.outln(s.name + '.service');
        ctx.outln('● ├─system.slice');
        ctx.outln('● └─sysinit.target');
        return 0;
      }

      default:
        ctx.errln('Unknown command verb ' + sub + '.');
        return 1;
    }
  });

  register('journalctl', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'f b r k x e', value: 'u n p',
                                    long: { '--unit': 'u', '--lines': 'n', '--priority': 'p',
                                            '--follow': 'f', '--reverse': 'r',
                                            '--dmesg': 'k', '--boot': 'b' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    if (ctx.sh.user.uid !== 0 && parsed.flags.u === undefined) {
      // A normal user sees only their own journal; the lab's is root's.
      ctx.errln('Hint: You are currently not seeing messages from other users and the ' +
        'system.');
      ctx.errln('      Users in groups \'adm\', \'systemd-journal\', \'wheel\' can see all ' +
        'messages.');
    }
    let rows = m.journal.slice();
    if (parsed.flags.u !== undefined) {
      const want = String(parsed.flags.u).replace(/\.service$/, '');
      rows = rows.filter(function (j) { return j.unit === want; });
    }
    if (parsed.flags.p !== undefined) {
      const levels = { emerg: 0, alert: 1, crit: 2, err: 3, warning: 4, notice: 5,
                       info: 6, debug: 7 };
      const want = /^\d$/.test(parsed.flags.p) ? +parsed.flags.p : levels[parsed.flags.p];
      rows = rows.filter(function (j) { return j.priority <= want; });
    }
    if (parsed.flags.k) rows = rows.filter(function (j) { return j.unit === 'kernel'; });
    if (parsed.flags.r) rows.reverse();
    if (parsed.flags.n !== undefined) {
      const n = parseInt(parsed.flags.n, 10) || 10;
      rows = parsed.flags.r ? rows.slice(0, n) : rows.slice(-n);
    }
    ctx.outln('-- Logs begin at ' + m.formatStamp(m.bootTime) + '. --');
    rows.forEach(function (j) {
      ctx.outln(j.time + ' ' + m.shortHostname + ' ' + j.unit +
        (j.pid ? '[' + j.pid + ']' : '') + ': ' + j.message);
    });
    if (parsed.flags.f) ctx.errln('journalctl: this terminal cannot follow the journal live');
    return 0;
  });

  /* =========================================================================
   * Networking (chapters 17, 18, 19)
   * ======================================================================= */

  register('ip', function (ctx) {
    const m = ctx.m;
    const args = ctx.args.filter(function (a) { return a !== '-c' && a !== '--color'; });
    const stats = args.indexOf('-s') !== -1;
    const clean = args.filter(function (a) { return a.charAt(0) !== '-'; });
    const object = (clean[0] || 'addr').replace(/^a$/, 'addr').replace(/^l$/, 'link')
      .replace(/^r$/, 'route');
    const verb = clean[1] || 'show';
    const dev = clean[2] === 'dev' ? clean[3] : clean[2];

    if (object.indexOf('addr') === 0 || object === 'a') {
      const list = m.network.interfaces.filter(function (i) { return !dev || i.name === dev; });
      if (!list.length) { ctx.errln('Device "' + dev + '" does not exist.'); return 1; }
      list.forEach(function (iface, idx) {
        ctx.outln((idx + 1) + ': ' + iface.name + ': <' + iface.flags + '> mtu ' + iface.mtu +
          ' qdisc fq_codel state ' + iface.state + ' group default qlen 1000');
        ctx.outln('    link/' + (iface.name === 'lo' ? 'loopback' : 'ether') + ' ' + iface.mac +
          ' brd ' + (iface.name === 'lo' ? '00:00:00:00:00:00' : 'ff:ff:ff:ff:ff:ff'));
        iface.addrs.forEach(function (a) {
          ctx.outln('    ' + a.family + ' ' + a.address + '/' + a.prefix +
            (a.broadcast ? ' brd ' + a.broadcast : '') + ' scope ' + a.scope +
            (a.label ? ' ' + a.label : ''));
          ctx.outln('       valid_lft forever preferred_lft forever');
        });
      });
      return 0;
    }

    if (object.indexOf('link') === 0) {
      const list = m.network.interfaces.filter(function (i) { return !dev || i.name === dev; });
      if (!list.length) { ctx.errln('Device "' + dev + '" does not exist.'); return 1; }
      list.forEach(function (iface, idx) {
        ctx.outln((idx + 1) + ': ' + iface.name + ': <' + iface.flags + '> mtu ' + iface.mtu +
          ' qdisc fq_codel state ' + iface.state + ' mode DEFAULT group default qlen 1000');
        ctx.outln('    link/' + (iface.name === 'lo' ? 'loopback' : 'ether') + ' ' + iface.mac +
          ' brd ' + (iface.name === 'lo' ? '00:00:00:00:00:00' : 'ff:ff:ff:ff:ff:ff'));
        if (stats && iface.rx) {
          ctx.outln('    RX: bytes  packets  errors  dropped overrun mcast');
          ctx.outln('    ' + String(iface.rx.bytes).padStart(10) + ' ' +
            String(iface.rx.packets).padStart(8) + ' ' + String(iface.rx.errors).padStart(7) +
            ' ' + String(iface.rx.dropped).padStart(7) + '       0       0');
          ctx.outln('    TX: bytes  packets  errors  dropped carrier collsns');
          ctx.outln('    ' + String(iface.tx.bytes).padStart(10) + ' ' +
            String(iface.tx.packets).padStart(8) + ' ' + String(iface.tx.errors).padStart(7) +
            ' ' + String(iface.tx.dropped).padStart(7) + '       0       0');
        }
      });
      return 0;
    }

    if (object.indexOf('route') === 0 || object === 'r') {
      m.network.routes.forEach(function (r) {
        ctx.outln(r.dest + (r.via ? ' via ' + r.via : '') + ' dev ' + r.dev +
          ' proto ' + r.proto + (r.scope ? ' scope ' + r.scope : '') +
          (r.src ? ' src ' + r.src : '') + ' metric ' + r.metric);
      });
      return 0;
    }

    ctx.errln('Object "' + object + '" is unknown, try "ip help".');
    return 1;
  });

  register('ss', function (ctx) {
    const m = ctx.m;
    const raw = ctx.args.join('');
    const listening = raw.indexOf('l') !== -1;
    const showProc = raw.indexOf('p') !== -1;
    const numeric = raw.indexOf('n') !== -1;
    const rows = m.network.listening.filter(function (r) {
      if (raw.indexOf('t') !== -1 && raw.indexOf('u') === -1) return r.proto === 'tcp';
      if (raw.indexOf('u') !== -1 && raw.indexOf('t') === -1) return r.proto === 'udp';
      return true;
    });
    ctx.outln('Netid  State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port  Process');
    rows.forEach(function (r) {
      ctx.outln(r.proto.padEnd(7) + 'LISTEN  0       128      ' + r.local.padEnd(22) +
        r.peer.padEnd(19) + (showProc ? r.process : ''));
    });
    return 0;
  });

  register('nmcli', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; });
    const object = (args[0] || '').replace(/^dev$/, 'device').replace(/^d$/, 'device')
      .replace(/^con$/, 'connection').replace(/^c$/, 'connection')
      .replace(/^g$/, 'general');
    const verb = args[1] || 'show';
    const name = args[2];
    const net = m.network;

    if (object === 'device') {
      if (verb === 'status' || verb === 'show' && !name) {
        ctx.outln('DEVICE  TYPE      STATE                   CONNECTION');
        net.interfaces.forEach(function (i) {
          const con = net.connections.find(function (c) { return c.device === i.name; });
          ctx.outln(i.name.padEnd(8) +
            (i.name === 'lo' ? 'loopback' : 'ethernet').padEnd(10) +
            (i.state === 'UP' ? 'connected' : 'unmanaged').padEnd(24) +
            (con ? con.name : '--'));
        });
        return 0;
      }
      if (verb === 'show') {
        const iface = net.interfaces.find(function (i) { return i.name === name; });
        if (!iface) { ctx.errln('Error: Device \'' + name + '\' not found.'); return 10; }
        ctx.outln('GENERAL.DEVICE:                         ' + iface.name);
        ctx.outln('GENERAL.TYPE:                           ethernet');
        ctx.outln('GENERAL.HWADDR:                         ' + iface.mac.toUpperCase());
        ctx.outln('GENERAL.MTU:                            ' + iface.mtu);
        ctx.outln('GENERAL.STATE:                          100 (connected)');
        iface.addrs.filter(function (a) { return a.family === 'inet'; })
          .forEach(function (a, i) {
            ctx.outln('IP4.ADDRESS[' + (i + 1) + ']:                        ' +
              a.address + '/' + a.prefix);
          });
        ctx.outln('IP4.GATEWAY:                            172.25.250.254');
        return 0;
      }
    }

    if (object === 'connection') {
      if (verb === 'show' && !name) {
        ctx.outln('NAME  UUID                                  TYPE      DEVICE');
        net.connections.forEach(function (c) {
          ctx.outln(c.name.padEnd(6) + c.uuid + '  ' + c.type.padEnd(10) +
            (c.active ? c.device : '--'));
        });
        return 0;
      }
      if (verb === 'show') {
        const c = net.connections.find(function (x) { return x.name === name; });
        if (!c) { ctx.errln('Error: ' + name + ' - no such connection profile.'); return 10; }
        ctx.outln('connection.id:                          ' + c.name);
        ctx.outln('connection.uuid:                        ' + c.uuid);
        ctx.outln('connection.type:                        802-3-ethernet');
        ctx.outln('connection.interface-name:              ' + c.device);
        ctx.outln('connection.autoconnect:                 ' + (c.autoconnect ? 'yes' : 'no'));
        ctx.outln('ipv4.method:                            ' + c.method);
        ctx.outln('ipv4.addresses:                         ' + c.address);
        ctx.outln('ipv4.gateway:                           ' + c.gateway);
        ctx.outln('ipv4.dns:                               ' + c.dns.join(','));
        return 0;
      }
      if (verb === 'up' || verb === 'down') {
        if (sh.user.uid !== 0) {
          ctx.errln('Error: Connection activation failed: insufficient privileges.');
          return 4;
        }
        const c = net.connections.find(function (x) { return x.name === name; });
        if (!c) { ctx.errln('Error: unknown connection \'' + name + '\'.'); return 10; }
        c.active = verb === 'up';
        ctx.outln(verb === 'up'
          ? 'Connection successfully activated (D-Bus active path: ' +
            '/org/freedesktop/NetworkManager/ActiveConnection/2)'
          : 'Connection \'' + name + '\' successfully deactivated.');
        return 0;
      }
      if (verb === 'mod' || verb === 'modify') {
        if (sh.user.uid !== 0) {
          ctx.errln('Error: Failed to modify connection \'' + name + '\': insufficient privileges.');
          return 4;
        }
        const c = net.connections.find(function (x) { return x.name === name; });
        if (!c) { ctx.errln('Error: unknown connection \'' + name + '\'.'); return 10; }
        for (let i = 3; i < args.length - 1; i += 2) {
          const key = args[i], value = args[i + 1];
          if (key === 'ipv4.addresses') c.address = value;
          else if (key === 'ipv4.gateway') c.gateway = value;
          else if (key === 'ipv4.dns') c.dns = value.split(',');
          else if (key === 'ipv4.method') c.method = value;
          else if (key === 'connection.autoconnect') c.autoconnect = value === 'yes';
        }
        return 0;
      }
      if (verb === 'add') {
        if (sh.user.uid !== 0) {
          ctx.errln('Error: Failed to add connection: insufficient privileges.');
          return 4;
        }
        const conName = (function () {
          const i = args.indexOf('con-name');
          return i === -1 ? 'ethernet' : args[i + 1];
        })();
        net.connections.push({
          name: conName, uuid: 'a1b2c3d4-0000-4000-8000-00000000' +
            String(net.connections.length).padStart(4, '0'),
          type: 'ethernet', device: 'ens3', autoconnect: true, active: false,
          method: 'auto', address: '', gateway: '', dns: []
        });
        ctx.outln("Connection '" + conName + "' (a1b2c3d4) successfully added.");
        return 0;
      }
    }

    if (object === 'general') {
      ctx.outln('STATE      CONNECTIVITY  WIFI-HW  WIFI     WWAN-HW  WWAN');
      ctx.outln('connected  full          enabled  enabled  enabled  enabled');
      return 0;
    }

    ctx.errln('Error: argument \'' + (args[0] || '') + '\' not understood. Try passing --help.');
    return 2;
  });

  register('hostname domainname', function (ctx) {
    const m = ctx.m;
    if (ctx.args[0] === '-s') { ctx.outln(m.shortHostname); return 0; }
    if (ctx.args[0] === '-i' || ctx.args[0] === '-I') { ctx.outln('172.25.250.10'); return 0; }
    if (ctx.args.length && ctx.args[0].charAt(0) !== '-') {
      ctx.errln('hostname: you must be root to change the host name');
      return 1;
    }
    ctx.outln(ctx.name === 'domainname' ? 'lab.example.com' : m.hostname);
    return 0;
  });

  register('hostnamectl', function (ctx) {
    const m = ctx.m;
    const sub = ctx.args[0];
    if (sub === 'set-hostname') {
      if (ctx.sh.user.uid !== 0) {
        ctx.errln('Could not set property: Access denied');
        return 1;
      }
      m.hostname = ctx.args[1];
      m.shortHostname = String(ctx.args[1]).split('.')[0];
      try {
        const f = m.resolve('/etc/hostname').node;
        f.content = m.hostname + '\n';
      } catch (e) { /* the file will be recreated on demand */ }
      return 0;
    }
    ctx.outln(' Static hostname: ' + m.hostname);
    ctx.outln('       Icon name: computer-vm');
    ctx.outln('         Chassis: vm');
    ctx.outln('      Machine ID: 9f3b1a247c584a1d9b0e5c2f1d8a63e7');
    ctx.outln('         Boot ID: 4c1e8a6d4b30b1f4f9e35b2a4a8c9f7d');
    ctx.outln('  Virtualization: kvm');
    ctx.outln('Operating System: Red Hat Enterprise Linux 9.0 (Plow)');
    ctx.outln('     CPE OS Name: cpe:/o:redhat:enterprise_linux:9::baseos');
    ctx.outln('          Kernel: Linux 5.14.0-70.22.1.el9_0.x86_64');
    ctx.outln('    Architecture: x86-64');
    return 0;
  });

  register('ping', function (ctx) {
    const m = ctx.m;
    const args = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; });
    const target = args[args.length - 1];
    if (!target) return ctx.usage('usage: ping [-c count] destination');
    const known = m.network.reachable.indexOf(target) !== -1;
    const host = m.network.hosts.find(function (h) {
      return h.ip === target || h.names.indexOf(target) !== -1;
    });
    if (!known && !host) {
      ctx.errln('ping: ' + target + ': Name or service not known');
      return 2;
    }
    const ip = host ? host.ip : target;
    const count = (function () {
      const i = ctx.args.indexOf('-c');
      return i === -1 ? 4 : parseInt(ctx.args[i + 1], 10) || 4;
    })();
    ctx.outln('PING ' + target + ' (' + ip + ') 56(84) bytes of data.');
    for (let i = 1; i <= count; i++) {
      ctx.outln('64 bytes from ' + ip + ': icmp_seq=' + i + ' ttl=64 time=0.' +
        (200 + i * 37) % 1000 + ' ms');
    }
    ctx.outln('');
    ctx.outln('--- ' + target + ' ping statistics ---');
    ctx.outln(count + ' packets transmitted, ' + count +
      ' received, 0% packet loss, time ' + (count * 1000 - 1) + 'ms');
    ctx.outln('rtt min/avg/max/mdev = 0.221/0.284/0.347/0.045 ms');
    return 0;
  });

  register('dig host nslookup', function (ctx) {
    const m = ctx.m;
    const target = ctx.args.filter(function (a) { return a.charAt(0) !== '-' && a.charAt(0) !== '+'; })[0];
    if (!target) return ctx.usage('usage: ' + ctx.name + ' name');
    const host = m.network.hosts.find(function (h) {
      return h.names.indexOf(target) !== -1 || h.ip === target;
    });
    if (!host) {
      if (ctx.name === 'host') ctx.outln('Host ' + target + ' not found: 3(NXDOMAIN)');
      else ctx.errln(ctx.name + ': no servers could be reached');
      return 1;
    }
    if (ctx.name === 'host') {
      ctx.outln(host.names[0] + ' has address ' + host.ip);
      return 0;
    }
    if (ctx.name === 'nslookup') {
      ctx.outln('Server:\t\t' + m.network.dns[0]);
      ctx.outln('Address:\t' + m.network.dns[0] + '#53');
      ctx.outln('');
      ctx.outln('Name:\t' + host.names[0]);
      ctx.outln('Address: ' + host.ip);
      return 0;
    }
    ctx.outln('; <<>> DiG 9.16.23-RH <<>> ' + target);
    ctx.outln(';; global options: +cmd');
    ctx.outln(';; Got answer:');
    ctx.outln(';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41203');
    ctx.outln('');
    ctx.outln(';; QUESTION SECTION:');
    ctx.outln(';' + host.names[0] + '.\t\t\tIN\tA');
    ctx.outln('');
    ctx.outln(';; ANSWER SECTION:');
    ctx.outln(host.names[0] + '.\t\t60\tIN\tA\t' + host.ip);
    ctx.outln('');
    ctx.outln(';; SERVER: ' + m.network.dns[0] + '#53(' + m.network.dns[0] + ')');
    return 0;
  });

  register('ssh scp sftp', function (ctx) {
    const m = ctx.m;
    const target = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; })[0] || '';
    const hostPart = target.indexOf('@') === -1 ? target : target.split('@')[1];
    const known = m.network.reachable.indexOf(hostPart.replace(/:.*$/, '')) !== -1;
    if (!known) {
      ctx.errln('ssh: Could not resolve hostname ' + hostPart + ': Name or service not known');
      return 255;
    }
    ctx.errln(ctx.name + ': this practice terminal has one machine, so a remote session ' +
      'cannot be opened.');
    ctx.errln('The study guide covers the key exchange, ~/.ssh/known_hosts and ' +
      'authorized_keys.');
    return 1;
  });

  register('ssh-keygen', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const parsed = parseArgs(ctx, { bool: 'q y', value: 't f N C b' });
    if (!parsed) return ctx.status;
    const type = parsed.flags.t || 'rsa';
    const file = parsed.flags.f || (sh.user.home + '/.ssh/id_' + type);
    const bits = type === 'rsa' ? (parsed.flags.b || 3072) : 256;

    ctx.outln('Generating public/private ' + type + ' key pair.');
    const dir = m.forceDir(file.replace(/\/[^/]*$/, ''), 0o700);
    dir.uid = sh.user.uid;
    dir.gid = sh.user.gid;

    const fingerprint = 'SHA256:' + ('abcdefghijkmnpqrstuvwxyz023456789' +
      file).slice(2, 45);
    const priv = m.forceCreate(file, '-----BEGIN OPENSSH PRIVATE KEY-----\n' +
      '(generated in the practice terminal)\n-----END OPENSSH PRIVATE KEY-----\n', 0o600);
    priv.uid = sh.user.uid;
    priv.gid = sh.user.gid;
    priv.mode = 0o600;
    const pub = m.forceCreate(file + '.pub', 'ssh-' + type + ' AAAAB3NzaC1yc2EAAAADAQABAAAB' +
      'gQDx' + type + ' ' + sh.user.name + '@' + m.shortHostname + '\n', 0o644);
    pub.uid = sh.user.uid;
    pub.gid = sh.user.gid;

    ctx.outln('Your identification has been saved in ' + file);
    ctx.outln('Your public key has been saved in ' + file + '.pub');
    ctx.outln('The key fingerprint is:');
    ctx.outln(fingerprint + ' ' + sh.user.name + '@' + m.shortHostname);
    return 0;
  });

  register('ssh-copy-id ssh-agent ssh-add', function (ctx) {
    ctx.errln(ctx.name + ': there is no second machine in this practice terminal, so a key ' +
      'cannot be copied to one.');
    ctx.errln('The study guide covers what it does: append your public key to the remote ' +
      "account's ~/.ssh/authorized_keys.");
    return 1;
  });

  register('firewall-cmd', function (ctx) {
    const args = ctx.args;
    if (args.indexOf('--state') !== -1) { ctx.outln('running'); return 0; }
    if (args.indexOf('--get-default-zone') !== -1) { ctx.outln('public'); return 0; }
    if (args.indexOf('--list-all') !== -1) {
      ctx.outln('public (active)');
      ctx.outln('  target: default');
      ctx.outln('  interfaces: ens3');
      ctx.outln('  sources: ');
      ctx.outln('  services: cockpit dhcpv6-client ssh');
      ctx.outln('  ports: ');
      return 0;
    }
    if (ctx.sh.user.uid !== 0) {
      ctx.errln('Error: Authorization failed.');
      return 1;
    }
    ctx.outln('success');
    return 0;
  });

  register('tracepath', function (ctx) {
    ctx.outln(' 1?: [LOCALHOST]                      pmtu 1500');
    ctx.outln(' 1:  classroom.example.com           0.412ms');
    ctx.outln('     Resume: pmtu 1500 hops 1 back 1');
    return 0;
  });

  /* =========================================================================
   * Storage (chapter 14)
   * ======================================================================= */

  register('lsblk', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'f p a', long: { '--fs': 'f', '--paths': 'p' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const fs = !!parsed.flags.f;
    const prefix = parsed.flags.p ? '/dev/' : '';

    if (fs) ctx.outln('NAME   FSTYPE FSVER LABEL      UUID                                 MOUNTPOINTS');
    else ctx.outln('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS');

    m.blockDevices.forEach(function (dev, di) {
      function row(d, depth, ci) {
        const major = d.type === 'rom' ? 11 : 8;
        const minor = major === 11 ? 0 : di * 16 + (depth ? ci + 1 : 0);
        const name = (depth ? (d === (dev.children || [])[(dev.children || []).length - 1]
          ? '└─' : '├─') : '') + prefix + d.name;
        if (fs) {
          ctx.outln(name.padEnd(7) + String(d.fstype || '').padEnd(7) +
            (d.fstype ? '1.0   ' : '      ') + String(d.label || '').padEnd(11) +
            String(d.uuid || '').padEnd(37) + (d.mountpoint || ''));
        } else {
          ctx.outln(name.padEnd(7) + (major + ':' + minor).padStart(7) + ' ' +
            (d.rm === undefined ? (dev.rm ? 1 : 0) : (d.rm ? 1 : 0)) + ' ' +
            String(d.size).padStart(5) + ' ' + (d.ro ? 1 : 0) + ' ' +
            String(d.type).padEnd(5) + (d.mountpoint || ''));
        }
      }
      row(dev, 0, 0);
      (dev.children || []).forEach(function (child, ci) { row(child, 1, ci); });
    });
    return 0;
  });

  register('blkid', function (ctx) {
    const m = ctx.m;
    const want = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    m.blockDevices.forEach(function (dev) {
      (dev.children || []).concat(dev.fstype ? [dev] : []).forEach(function (d) {
        if (!d.uuid) return;
        const path = '/dev/' + d.name;
        if (want && want !== path) return;
        ctx.outln(path + ': ' + (d.label ? 'LABEL="' + d.label + '" ' : '') +
          'UUID="' + d.uuid + '" BLOCK_SIZE="512" TYPE="' + d.fstype + '"' +
          ' PARTUUID="1a2b3c4d-0' + d.name.slice(-1) + '"');
      });
    });
    return 0;
  });

  register('df', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'h T i a',
                                    long: { '--human-readable': 'h', '--print-type': 'T',
                                            '--inodes': 'i' } });
    if (!parsed) return ctx.status;
    const m = ctx.m;
    const h = !!parsed.flags.h;
    const T = !!parsed.flags.T;

    function size(kb) {
      if (!h) return String(kb);
      return S.humanSize(kb * 1024);
    }
    ctx.outln('Filesystem'.padEnd(16) + (T ? 'Type'.padEnd(10) : '') +
      (h ? 'Size'.padStart(6) + '  Used Avail Use% Mounted on'
         : '1K-blocks'.padStart(10) + '    Used Available Use% Mounted on'));
    m.mounts.forEach(function (mt) {
      const usePct = Math.round((mt.used / (mt.used + mt.avail || 1)) * 100);
      ctx.outln(mt.source.padEnd(16) + (T ? mt.fstype.padEnd(10) : '') +
        size(mt.size).padStart(h ? 6 : 10) + ' ' + size(mt.used).padStart(h ? 5 : 7) + ' ' +
        size(mt.avail).padStart(h ? 5 : 9) + ' ' + (usePct + '%').padStart(4) + ' ' + mt.target);
    });
    return 0;
  });

  register('du', function (ctx) {
    const parsed = parseArgs(ctx, { bool: 'h s a c', value: 'd',
                                    long: { '--human-readable': 'h', '--summarize': 's',
                                            '--all': 'a', '--max-depth': 'd', '--total': 'c' } });
    if (!parsed) return ctx.status;
    const m = ctx.m, sh = ctx.sh;
    const h = !!parsed.flags.h;
    const maxDepth = parsed.flags.d !== undefined ? parseInt(parsed.flags.d, 10)
      : (parsed.flags.s ? 0 : Infinity);
    const targets = parsed.operands.length ? parsed.operands : ['.'];
    let grand = 0;

    function show(kb, label) {
      ctx.outln((h ? S.humanSize(kb * 1024) : String(kb)) + '\t' + label);
    }

    targets.forEach(function (t) {
      let found;
      try { found = sh.resolve(t); } catch (err) {
        ctx.errln("du: cannot access '" + t + "': No such file or directory");
        ctx.status = 1;
        return;
      }
      function walk(node, label, depth) {
        let total = node.type === 'dir' ? 4 : Math.ceil(m.sizeOf(node) / 1024) * 4;
        if (node.type === 'dir') {
          Array.from(node.entries.keys()).sort().forEach(function (name) {
            total += walk(node.entries.get(name), label + '/' + name, depth + 1);
          });
        }
        const isFile = node.type !== 'dir';
        if (depth <= maxDepth && (!isFile || parsed.flags.a)) show(total, label);
        return total;
      }
      grand += walk(found.node, t.replace(/\/$/, ''), 0);
    });
    if (parsed.flags.c) show(grand, 'total');
    return ctx.status;
  });

  register('mount', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const args = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; });
    if (!args.length) {
      m.mounts.forEach(function (mt) {
        ctx.outln(mt.source + ' on ' + mt.target + ' type ' + mt.fstype + ' (rw,relatime)');
      });
      return 0;
    }
    if (sh.user.uid !== 0) {
      ctx.errln('mount: only root can do that.');
      return 1;
    }
    const device = args[0];
    const target = args[1];
    if (!target) return ctx.usage('usage: mount device directory');

    const part = findPartition(m, device);
    if (!part) {
      ctx.errln('mount: ' + target + ': special device ' + device + ' does not exist.');
      return 32;
    }
    if (part.mountpoint) {
      ctx.errln('mount: ' + target + ': ' + device + ' already mounted on ' +
        part.mountpoint + '.');
      return 32;
    }
    let dir;
    try {
      dir = sh.resolve(target);
    } catch (err) {
      ctx.errln('mount: ' + target + ': mount point does not exist.');
      return 32;
    }
    if (dir.node.type !== 'dir') {
      ctx.errln('mount: ' + target + ': mount point is not a directory.');
      return 32;
    }

    part.mountpoint = m.absolute(target, sh.cwd);
    m.mounts.push({ source: '/dev/' + part.name, fstype: part.fstype, size: 2097152,
                    used: 1024, avail: 2096128, target: part.mountpoint });

    // The removable volume's files appear under the mount point, as they would.
    if (m.removable && m.removable.device === '/dev/' + part.name) {
      (function place(spec, node) {
        Object.keys(spec).forEach(function (name) {
          const value = spec[name];
          if (typeof value === 'string') {
            const f = m.newInode({ type: 'file', mode: 0o755, content: value });
            node.entries.set(name, f);
          } else {
            const d = m.newInode({ type: 'dir', mode: 0o755, entries: new Map(),
                                   nlink: 2, content: null });
            node.entries.set(name, d);
            node.nlink += 1;
            place(value, d);
          }
        });
      })(m.removable.content, dir.node);
    }
    return 0;
  });

  function findPartition(m, spec) {
    const byName = String(spec).replace(/^\/dev\//, '');
    let found = null;
    m.blockDevices.forEach(function (dev) {
      (dev.children || []).concat([dev]).forEach(function (d) {
        if (d.name === byName) found = d;
        if (spec.indexOf('UUID=') === 0 && d.uuid === spec.slice(5)) found = d;
        if (spec.indexOf('LABEL=') === 0 && d.label === spec.slice(6)) found = d;
      });
    });
    return found;
  }

  register('umount', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const target = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    if (!target) return ctx.usage('usage: umount directory|device');
    if (sh.user.uid !== 0) {
      ctx.errln('umount: ' + target + ': must be superuser to unmount.');
      return 32;
    }
    const abs = m.absolute(target, sh.cwd);
    const mt = m.mounts.find(function (x) {
      return x.target === abs || x.source === target;
    });
    if (!mt) {
      ctx.errln('umount: ' + target + ': not mounted.');
      return 32;
    }
    if (sh.cwd === mt.target || sh.cwd.indexOf(mt.target + '/') === 0) {
      ctx.errln('umount: ' + mt.target + ': target is busy.');
      return 32;
    }
    m.mounts = m.mounts.filter(function (x) { return x !== mt; });
    const part = findPartition(m, mt.source);
    if (part) part.mountpoint = null;
    try {
      const dir = m.resolve(mt.target).node;
      if (dir && dir.entries) { dir.entries.clear(); dir.nlink = 2; }
    } catch (e) { /* the mount point went away */ }
    return 0;
  });

  register('findmnt', function (ctx) {
    const m = ctx.m;
    ctx.outln('TARGET'.padEnd(20) + 'SOURCE'.padEnd(14) + 'FSTYPE'.padEnd(10) + 'OPTIONS');
    m.mounts.forEach(function (mt) {
      ctx.outln(mt.target.padEnd(20) + mt.source.padEnd(14) + mt.fstype.padEnd(10) +
        'rw,relatime');
    });
    return 0;
  });

  register('locate', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const parsed = parseArgs(ctx, { bool: 'i', value: 'n' });
    if (!parsed) return ctx.status;
    const pattern = parsed.operands[0];
    if (!pattern) return ctx.usage('no pattern to search for specified');

    // The database is a snapshot: files made since the last updatedb are missing.
    if (!m.locateDb) {
      m.locateDb = [];
      (function walk(node, path) {
        m.locateDb.push(path || '/');
        if (node.type !== 'dir') return;
        node.entries.forEach(function (child, name) {
          walk(child, path + '/' + name);
        });
      })(m.root, '');
      m.locateDbBuiltAt = m.now;
    }

    const re = new RegExp(String(pattern).replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*'), parsed.flags.i ? 'i' : '');
    let hits = m.locateDb.filter(function (p) { return re.test(p); });
    if (parsed.flags.n) hits = hits.slice(0, parseInt(parsed.flags.n, 10));
    hits.forEach(function (p) { ctx.outln(p); });
    return hits.length ? 0 : 1;
  });

  register('updatedb', function (ctx) {
    if (ctx.sh.user.uid !== 0) {
      ctx.errln('updatedb: can not open a temporary file for `/var/lib/mlocate/mlocate.db\'');
      return 1;
    }
    delete ctx.m.locateDb;
    return 0;
  });

  /* =========================================================================
   * Odds and ends
   * ======================================================================= */

  register('date', function (ctx) {
    const m = ctx.m;
    const dt = new Date(m.now);
    const fmt = ctx.args.find(function (a) { return a.charAt(0) === '+'; });
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const p2 = function (n) { return (n < 10 ? '0' : '') + n; };

    if (fmt) {
      ctx.outln(fmt.slice(1)
        .replace(/%Y/g, String(dt.getUTCFullYear()))
        .replace(/%m/g, p2(dt.getUTCMonth() + 1))
        .replace(/%d/g, p2(dt.getUTCDate()))
        .replace(/%H/g, p2(dt.getUTCHours()))
        .replace(/%M/g, p2(dt.getUTCMinutes()))
        .replace(/%S/g, p2(dt.getUTCSeconds()))
        .replace(/%b/g, MON[dt.getUTCMonth()])
        .replace(/%a/g, DAY[dt.getUTCDay()])
        .replace(/%s/g, String(Math.floor(m.now / 1000)))
        .replace(/%F/g, dt.getUTCFullYear() + '-' + p2(dt.getUTCMonth() + 1) + '-' +
          p2(dt.getUTCDate()))
        .replace(/%T/g, p2(dt.getUTCHours()) + ':' + p2(dt.getUTCMinutes()) + ':' +
          p2(dt.getUTCSeconds())));
      return 0;
    }
    ctx.outln(DAY[dt.getUTCDay()] + ' ' + MON[dt.getUTCMonth()] + ' ' +
      String(dt.getUTCDate()).padStart(2) + ' ' + p2(dt.getUTCHours()) + ':' +
      p2(dt.getUTCMinutes()) + ':' + p2(dt.getUTCSeconds()) + ' EDT ' + dt.getUTCFullYear());
    return 0;
  });

  register('timedatectl', function (ctx) {
    const m = ctx.m;
    ctx.outln('               Local time: ' + m.formatStamp(m.now) + ' EDT');
    ctx.outln('           Universal time: ' + m.formatStamp(m.now) + ' UTC');
    ctx.outln('                 Time zone: America/New_York (EDT, -0400)');
    ctx.outln('System clock synchronized: yes');
    ctx.outln('              NTP service: active');
    return 0;
  });

  register('uname', function (ctx) {
    const raw = ctx.args.join('');
    const kernel = '5.14.0-70.22.1.el9_0.x86_64';
    if (raw.indexOf('a') !== -1) {
      ctx.outln('Linux ' + ctx.m.hostname + ' ' + kernel +
        ' #1 SMP PREEMPT_DYNAMIC Tue Jun 14 10:21:00 EDT 2025 x86_64 x86_64 x86_64 GNU/Linux');
      return 0;
    }
    if (raw.indexOf('r') !== -1) { ctx.outln(kernel); return 0; }
    if (raw.indexOf('n') !== -1) { ctx.outln(ctx.m.hostname); return 0; }
    if (raw.indexOf('m') !== -1 || raw.indexOf('p') !== -1) { ctx.outln('x86_64'); return 0; }
    ctx.outln('Linux');
    return 0;
  });

  register('lscpu', function (ctx) {
    ctx.outln('Architecture:            x86_64');
    ctx.outln('  CPU op-mode(s):        32-bit, 64-bit');
    ctx.outln('CPU(s):                  2');
    ctx.outln('Model name:              Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz');
    ctx.outln('Virtualization:          VT-x');
    ctx.outln('Hypervisor vendor:       KVM');
    return 0;
  });

  register('which', function (ctx) {
    const sh = ctx.sh;
    if (!ctx.args.length) return 1;
    ctx.args.forEach(function (name) {
      if (sh.aliases[name] !== undefined) {
        ctx.outln("alias " + name + "='" + sh.aliases[name] + "'");
      }
      const p = sh.onPath(name);
      if (p) ctx.outln(p);
      else {
        ctx.errln('/usr/bin/which: no ' + name + ' in (' + sh.env.PATH + ')');
        ctx.status = 1;
      }
    });
    return ctx.status;
  });

  register('whereis', function (ctx) {
    const sh = ctx.sh;
    ctx.args.forEach(function (name) {
      const bin = sh.onPath(name);
      const man = MAN[MAN_ALIASES[name] || name]
        ? ' /usr/share/man/man' + (MAN[MAN_ALIASES[name] || name][0]) + '/' + name + '.' +
          MAN[MAN_ALIASES[name] || name][0] + '.gz'
        : '';
      ctx.outln(name + ':' + (bin ? ' ' + bin : '') + man);
    });
    return 0;
  });

  register('tar', function (ctx) {
    const m = ctx.m, sh = ctx.sh;
    const raw = ctx.args.join(' ');
    const operands = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; });
    const fIndex = ctx.args.findIndex(function (a) { return /^-?\w*f/.test(a); });
    const archive = operands[0];
    const create = /c/.test(ctx.args[0] || '');
    const list = /t/.test(ctx.args[0] || '');
    const extract = /x/.test(ctx.args[0] || '');
    const verbose = /v/.test(ctx.args[0] || '');

    if (!archive) return ctx.fail('Refusing to read archive contents from terminal', 2);

    if (create) {
      const members = operands.slice(1);
      const manifest = [];
      members.forEach(function (p) {
        try {
          const found = sh.resolve(p);
          (function walk(node, label) {
            manifest.push(label + (node.type === 'dir' ? '/' : ''));
            if (node.type === 'dir') {
              Array.from(node.entries.keys()).sort().forEach(function (n) {
                walk(node.entries.get(n), label + '/' + n);
              });
            }
          })(found.node, p.replace(/\/$/, ''));
        } catch (err) {
          ctx.errln('tar: ' + p + ': Cannot stat: No such file or directory');
          ctx.status = 2;
        }
      });
      if (verbose) manifest.forEach(function (l) { ctx.outln(l); });
      const wrote = sh.writeTo(archive, '(tar archive)\n' +
        manifest.map(function (l) { return '# ' + l; }).join('\n') + '\n', false);
      if (wrote) { ctx.errln(wrote.replace(/\n$/, '')); return 2; }
      return ctx.status;
    }

    if (list) {
      try {
        const text = m.read(sh.resolve(archive).node);
        splitLines(text).forEach(function (l) {
          if (l.charAt(0) === '#') ctx.outln(l.slice(2));
        });
        return 0;
      } catch (err) {
        ctx.errln('tar: ' + archive + ': Cannot open: No such file or directory');
        return 2;
      }
    }

    if (extract) {
      ctx.errln('tar: this practice terminal stores an archive as a manifest, so ' +
        'extraction is not available. `tar -tf` lists what it holds.');
      return 2;
    }

    ctx.errln("tar: You must specify one of the '-Acdtrux' options");
    return 2;
  });

  register('gzip gunzip zcat bzip2', function (ctx) {
    const sh = ctx.sh, m = ctx.m;
    const target = ctx.args.filter(function (a) { return a.charAt(0) !== '-'; })[0];
    if (!target) return ctx.usage('missing operand');
    try {
      const found = sh.resolve(target, { follow: false });
      if (ctx.name === 'zcat') { ctx.out(m.read(found.node)); return 0; }
      const compressing = ctx.name === 'gzip' || ctx.name === 'bzip2';
      const suffix = ctx.name === 'bzip2' ? '.bz2' : '.gz';
      const newName = compressing ? found.name + suffix
        : found.name.replace(/\.(gz|bz2)$/, '');
      if (!compressing && newName === found.name) {
        ctx.errln(ctx.name + ': ' + target + ': unknown suffix -- ignored');
        return 1;
      }
      found.parent.entries.delete(found.name);
      found.parent.entries.set(newName, found.node);
      m.touchDir(found.parent);
      return 0;
    } catch (err) {
      ctx.errln(ctx.name + ': ' + target + ': No such file or directory');
      return 1;
    }
  });

  register('crontab', function (ctx) {
    if (ctx.args[0] === '-l') {
      ctx.errln('no crontab for ' + ctx.sh.user.name);
      return 1;
    }
    ctx.errln('crontab: editing a crontab needs a full-screen editor, which this ' +
      'practice terminal does not have.');
    return 1;
  });

  register('logger chronyc', function (ctx) { return 0; });

  register('clear', function (ctx) {
    ctx.clear = true;
    return 0;
  });

})();
