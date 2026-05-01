# Agent Health Snapshot

Generated: 2026-04-30T18:29:27.267Z

## Lane Status

- archivist: heartbeat=alive age=24s inbox=3 action-required=0 quarantine=27
- library: heartbeat=alive age=847s inbox=83 action-required=0 quarantine=16
- kernel: heartbeat=alive age=847s inbox=2 action-required=0 quarantine=12
- swarmmind: heartbeat=alive age=43s inbox=2 action-required=0 quarantine=0

## Process Inventory (node/kilo/cursor)

- Cursor.exe pid=1692 mem=2796 K
- Cursor.exe pid=7992 mem=2500 K
- Cursor.exe pid=16500 mem=23348 K
- Cursor.exe pid=21716 mem=23360 K
- Cursor.exe pid=22800 mem=616920 K
- Cursor.exe pid=24424 mem=4668 K
- Cursor.exe pid=25900 mem=4648 K
- Cursor.exe pid=38976 mem=7088 K
- Cursor.exe pid=41952 mem=103460 K
- Cursor.exe pid=44176 mem=10900 K
- Cursor.exe pid=47668 mem=682544 K
- Cursor.exe pid=51980 mem=243276 K
- Cursor.exe pid=56920 mem=8 K
- Cursor.exe pid=58088 mem=98544 K
- Cursor.exe pid=58712 mem=209128 K
- Cursor.exe pid=61924 mem=9632 K
- Cursor.exe pid=67124 mem=294108 K
- Cursor.exe pid=70132 mem=2764 K
- Cursor.exe pid=71884 mem=7276 K
- Cursor.exe pid=74724 mem=24692 K
- kilo.exe pid=24728 mem=276244 K
- kilo.exe pid=37400 mem=627988 K
- kilo.exe pid=49032 mem=505756 K
- kilo.exe pid=81700 mem=477576 K
- node.exe pid=440 mem=200 K
- node.exe pid=4756 mem=19088 K
- node.exe pid=6788 mem=4 K
- node.exe pid=8068 mem=4 K
- node.exe pid=16428 mem=4 K
- node.exe pid=16488 mem=37436 K
- node.exe pid=17016 mem=4 K
- node.exe pid=17140 mem=4 K
- node.exe pid=17320 mem=4 K
- node.exe pid=17800 mem=12888 K
- node.exe pid=18444 mem=2276 K
- node.exe pid=19792 mem=200 K
- node.exe pid=24260 mem=168 K
- node.exe pid=25044 mem=1596 K
- node.exe pid=26704 mem=32072 K
- node.exe pid=27080 mem=4 K
- node.exe pid=27564 mem=4 K
- node.exe pid=29328 mem=4 K
- node.exe pid=29980 mem=4 K
- node.exe pid=31160 mem=1588 K
- node.exe pid=31308 mem=1564 K
- node.exe pid=32984 mem=1616 K
- node.exe pid=33496 mem=4 K
- node.exe pid=36452 mem=8 K
- node.exe pid=38792 mem=4 K
- node.exe pid=38832 mem=1604 K
- node.exe pid=41280 mem=3628 K
- node.exe pid=44860 mem=4 K
- node.exe pid=45148 mem=19984 K
- node.exe pid=45176 mem=1568 K
- node.exe pid=45196 mem=1628 K
- node.exe pid=52240 mem=4 K
- node.exe pid=53360 mem=4240 K
- node.exe pid=55072 mem=1592 K
- node.exe pid=55768 mem=2228 K
- node.exe pid=57040 mem=4 K
- node.exe pid=59080 mem=1612 K
- node.exe pid=59412 mem=4 K
- node.exe pid=62440 mem=4 K
- node.exe pid=67328 mem=4 K
- node.exe pid=68852 mem=4 K
- node.exe pid=70208 mem=4 K
- node.exe pid=71532 mem=4 K
- node.exe pid=77636 mem=4 K
- node.exe pid=78560 mem=4 K
- node.exe pid=84548 mem=1336 K

## Suggested Actions

- If any heartbeat is stale (>900s), refresh lane heartbeat and re-check.
- If action-required grows, drain it before processed backlog.
- If process memory pressure rises, raise watcher poll interval.
