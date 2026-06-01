#!/usr/bin/env python3
"""Triage script for archivist inbox needs-review backlog.

Classifies items by type, moves stale items (>7 days) to processed/archive,
moves automated/high-volume alert storms to quarantine, and reports statistics.
NO deletion -- only move/reorganize. All data preserved.
"""

import json
import os
import shutil
import datetime
import re
import sys
from collections import Counter, defaultdict

INBOX = "/home/we4free/agent/repos/Archivist-Agent/lanes/archivist/inbox"
NEEDS_REVIEW = os.path.join(INBOX, "needs-review")
PROCESSED = os.path.join(INBOX, "processed")
QUARANTINE = os.path.join(INBOX, "quarantine")
BLOCKED = os.path.join(INBOX, "blocked")
ARCHIVE = os.path.join(INBOX, "archive")

STALE_THRESHOLD_DAYS = 7
ALERT_STORM_THRESHOLD = 100  # More than this many identical-type alerts = storm

CLASSIFICATIONS = Counter()
ACTIONS = Counter()
MOVED_FILES = defaultdict(list)

def ensure_dir(path):
    os.makedirs(path, exist_ok=True)

def parse_timestamp(ts_str):
    if not ts_str:
        return None
    try:
        return datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception:
        return None

def classify_item(data, filename):
    task_kind = data.get("task_kind", "unknown")
    item_type = data.get("type", "unknown")
    source = data.get("from", "unknown")
    subject = data.get("subject", "")
    priority = data.get("priority", "unknown")

    # Specific classification logic
    if task_kind == "heartbeat":
        return "heartbeat"
    if task_kind == "alert":
        return "resource-alert"
    if task_kind == "report":
        if "cycle" in subject.lower() or "cycle" in filename.lower():
            return "cycle-report"
        if "health" in subject.lower() or "hygiene" in subject.lower():
            return "health-report"
        return "report-other"
    if task_kind == "broadcast":
        return "broadcast"
    if "nack" in filename.lower() or "nack" in task_kind.lower():
        return "nack"
    if "test" in filename.lower() or "test" in subject.lower():
        return "test-artifact"
    if "load" in filename.lower() or "load" in subject.lower():
        return "load-test-artifact"
    if task_kind == "notification":
        return f"notification-{item_type}"
    if task_kind == "response":
        return "response"

    return f"other-{task_kind}"

def is_stale(data, now):
    ts = parse_timestamp(data.get("timestamp", ""))
    if ts is None:
        return True # No timestamp = treat as stale
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=datetime.timezone.utc)
    age = now - ts
    return age > datetime.timedelta(days=STALE_THRESHOLD_DAYS)

def is_alert_storm(classification, count):
    return classification == "resource-alert" and count > ALERT_STORM_THRESHOLD

def move_file(src, dst_dir, filename):
    ensure_dir(dst_dir)
    src_path = os.path.join(src, filename)
    dst_path = os.path.join(dst_dir, filename)
    try:
        if os.path.exists(dst_path):
            base, ext = os.path.splitext(filename)
            i = 1
            while os.path.exists(dst_path):
                dst_path = os.path.join(dst_dir, f"{base}_{i}{ext}")
                i += 1
        shutil.move(src_path, dst_path)
        return dst_path
    except (FileNotFoundError, OSError) as e:
        print(f"  WARNING: Could not move {filename}: {e}")
        return None

def main():
    now = datetime.datetime.now(datetime.timezone.utc)
    cutoff = now - datetime.timedelta(days=STALE_THRESHOLD_DAYS)

    print(f"=== Archivist Inbox Triage ===")
    print(f"Timestamp: {now.isoformat()}")
    print(f"Stale threshold: >{STALE_THRESHOLD_DAYS} days (before {cutoff.isoformat()})")
    print()

    # Ensure destination directories exist
    ensure_dir(os.path.join(PROCESSED, "archive"))
    ensure_dir(os.path.join(QUARANTINE, "archive"))
    ensure_dir(os.path.join(QUARANTINE, "alert-storm"))

    # Phase 1: Scan and classify all items
    print("Phase 1: Scanning and classifying...")
    files = sorted(os.listdir(NEEDS_REVIEW))
    print(f"  Total files in needs-review: {len(files)}")

    items = []
    classification_counts = Counter()
    source_counts = Counter()
    priority_counts = Counter()
    timestamp_min = None
    timestamp_max = None
    parse_errors = []

    for filename in files:
        filepath = os.path.join(NEEDS_REVIEW, filename)
        if not os.path.isfile(filepath):
            continue
        try:
            with open(filepath) as f:
            data = json.load(f)
            classification = classify_item(data, filename)
            items.append((filename, data, classification))
            classification_counts[classification] += 1
            source_counts[data.get("from", "unknown")] += 1
            priority_counts[data.get("priority", "unknown")] += 1
            ts = parse_timestamp(data.get("timestamp", ""))
            if ts:
                if timestamp_min is None or ts < timestamp_min:
                    timestamp_min = ts
                if timestamp_max is None or ts > timestamp_max:
                    timestamp_max = ts
        except Exception as e:
            parse_errors.append((filename, str(e)))
            items.append((filename, None, "parse-error"))

    print()
    print("=== Classification Summary ===")
    for cls, count in sorted(classification_counts.items(), key=lambda x: -x[1]):
        print(f"  {cls}: {count}")

    print()
    print("=== Source Summary ===")
    for src, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")

    print()
    print("=== Priority Summary ===")
    for pri, count in sorted(priority_counts.items(), key=lambda x: -x[1]):
        print(f"  {pri}: {count}")

    if timestamp_min and timestamp_max:
        print()
        print(f"=== Timestamp Range ===")
        print(f"  Earliest: {timestamp_min.isoformat()}")
        print(f"  Latest:   {timestamp_max.isoformat()}")
        span = timestamp_max - timestamp_min
        print(f"  Span:     {span}")

    if parse_errors:
        print()
        print(f"=== Parse Errors: {len(parse_errors)} ===")
        for fn, err in parse_errors[:5]:
            print(f"  {fn}: {err}")

    # Phase 2: Apply triage rules
    print()
    print("Phase 2: Applying triage rules...")

    stale_moved = 0
    storm_moved = 0
    test_moved = 0
    recent_kept = 0

    # Check if this is an alert storm (all same type, high volume, automated)
    alert_storm_active = is_alert_storm("resource-alert", classification_counts.get("resource-alert", 0))
    # Also check if a previous alert storm quarantine exists (ongoing storm)
    alert_storm_dir = os.path.join(QUARANTINE, "alert-storm")
    if not alert_storm_active and os.path.isdir(alert_storm_dir):
        existing_storm_count = len(os.listdir(alert_storm_dir))
        if existing_storm_count >= ALERT_STORM_THRESHOLD:
            alert_storm_active = True

    for filename, data, classification in items:
        if data is None:
            # Parse error - move to quarantine
            move_file(NEEDS_REVIEW, os.path.join(QUARANTINE, "parse-errors"), filename)
            ACTIONS["moved-to-quarantine-parse-error"] += 1
            MOVED_FILES["quarantine/parse-errors"].append(filename)
            continue

        # Rule 1: Stale items (>7 days) -> processed/archive
        if is_stale(data, now):
            move_file(NEEDS_REVIEW, os.path.join(PROCESSED, "archive"), filename)
            stale_moved += 1
            ACTIONS["moved-to-processed-archive-stale"] += 1
            MOVED_FILES["processed/archive"].append(filename)
            continue

        # Rule 2: Alert storm (high-volume automated resource alerts)
        # These are automated kernel resource alerts at P0, generated every ~20s.
        # Move to quarantine/alert-storm for review but out of needs-review.
        # Also catches trickle arrivals when a storm was previously identified.
        if alert_storm_active and classification == "resource-alert":
            move_file(NEEDS_REVIEW, os.path.join(QUARANTINE, "alert-storm"), filename)
            storm_moved += 1
            ACTIONS["moved-to-quarantine-alert-storm"] += 1
            MOVED_FILES["quarantine/alert-storm"].append(filename)
            continue

        # Rule 3: Test/load-test artifacts -> quarantine
        if classification in ("test-artifact", "load-test-artifact"):
            move_file(NEEDS_REVIEW, os.path.join(QUARANTINE, "test-artifacts"), filename)
            test_moved += 1
            ACTIONS["moved-to-quarantine-test"] += 1
            MOVED_FILES["quarantine/test-artifacts"].append(filename)
            continue

        # Rule 4: Everything else stays in needs-review for human review
        recent_kept += 1
        ACTIONS["kept-in-needs-review"] += 1

    # Phase 3: Report
    print()
    print("=== Triage Actions Taken ===")
    print(f"  Moved to processed/archive (stale >{STALE_THRESHOLD_DAYS} days): {stale_moved}")
    print(f"  Moved to quarantine/alert-storm (automated alert storm): {storm_moved}")
    print(f"  Moved to quarantine/test-artifacts: {test_moved}")
    print(f"  Moved to quarantine/parse-errors: {len(parse_errors)}")
    print(f"  Kept in needs-review (requires human review): {recent_kept}")

    remaining = len(os.listdir(NEEDS_REVIEW))
    print()
    print("=== Final State ===")
    print(f"  Remaining in needs-review: {remaining}")
    print(f"  Items in processed/: {len(os.listdir(PROCESSED))}")
    q_count = sum(len(fns) for _, _, fns in os.walk(QUARANTINE))
    print(f"  Items in quarantine/ (recursive): {q_count}")

    # Print destination summary
    print()
    print("=== Destination Directories ===")
    for dest, filelist in sorted(MOVED_FILES.items()):
        print(f"  {dest}: {len(filelist)} files")
        if len(filelist) <= 5:
            for f in filelist:
                print(f"    - {f}")
        else:
            for f in filelist[:3]:
                print(f"    - {f}")
            print(f"    ... and {len(filelist) - 3} more")

    print()
    print("=== Triage Complete ===")
    print("No files were deleted. All data preserved via move operations.")

    return {
        "classification_counts": dict(classification_counts),
        "stale_moved": stale_moved,
        "storm_moved": storm_moved,
        "test_moved": test_moved,
        "parse_error_moved": len(parse_errors),
        "kept_in_review": recent_kept,
        "remaining_in_needs_review": remaining,
    }

if __name__ == "__main__":
    result = main()
