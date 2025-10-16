#!/usr/bin/env python3
"""
Import students from CSV into Firestore.

CSV expected headers (case-sensitive):
  fullName (str), grade (int: 9-10), qrId (str), studentId (int or str), slotId (str: A1-H36)

Usage:
  python import_students.py --csv students.csv --sa serviceAccountKey.json --collection students

Requires:
  pip install google-cloud-firestore
  (and set up a Firebase/Google Cloud service account key JSON)
"""

import argparse
import csv
import re
from typing import Dict, Any

from google.cloud import firestore

SLOT_RE = re.compile(r'^([A-H])\s*([1-9]|[1-2]\d|3[0-6])$', re.IGNORECASE)

def normalize_slot(slot: str) -> str:
    if not slot:
        return ''
    s = slot.strip().upper()
    m = SLOT_RE.match(s)
    if not m:
        return ''
    return f'{m.group(1)}{m.group(2)}'

def parse_int(val, default=None):
    try:
        return int(str(val).strip())
    except Exception:
        return default

def coerce_record(row: Dict[str, str]) -> Dict[str, Any]:
    grade = parse_int(row.get('grade'), None)
    student_id_raw = row.get('studentId', '').strip()
    # Keep studentId as a string doc id to avoid numeric/leading-zero issues
    student_id = str(student_id_raw) if student_id_raw != '' else None
    slot = normalize_slot(row.get('slotId', ''))

    return {
        'fullName': (row.get('fullName') or '').strip(),
        'grade': grade,
        'qrId': (row.get('qrId') or '').strip(),
        'studentId': student_id,   # stored as string field as well
        'slotId': slot,            # normalized "A1".."H36" or '' if invalid
    }

def main():
    ap = argparse.ArgumentParser(description='Import students CSV to Firestore.')
    ap.add_argument('--csv', required=True, help='Path to CSV (with headers).')
    ap.add_argument('--sa', '--service-account', dest='sa', required=True,
                    help='Path to serviceAccountKey.json')
    ap.add_argument('--collection', default='students', help='Firestore collection name (default: students)')
    ap.add_argument('--merge', action='store_true',
                    help='Use merge (upsert) instead of overwrite.')
    ap.add_argument('--dry-run', action='store_true',
                    help='Parse/validate only; do not write to Firestore.')
    args = ap.parse_args()

    # Initialize Firestore using the provided service account key
    import os
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = args.sa
    db = firestore.Client()

    total = 0
    written = 0
    skipped = 0
    invalid_slot = 0
    missing_id = 0

    with open(args.csv, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            total += 1
            rec = coerce_record(row)

            if not rec['studentId']:
                print(f"[skip] row {total}: missing studentId")
                missing_id += 1
                continue

            if rec['slotId'] == '':
                # We'll still write the doc, but track invalid slot for awareness
                print(f"[warn] row {total}: invalid or missing slotId='{row.get('slotId','')}', normalized to ''")
                invalid_slot += 1

            doc_ref = db.collection(args.collection).document(rec['studentId'])

            if args.dry_run:
                print(f"[dry-run] would {'merge' if args.merge else 'set'} doc {rec['studentId']}: {rec}")
                written += 1  # count as would-write
            else:
                if args.merge:
                    doc_ref.set(rec, merge=True)
                else:
                    doc_ref.set(rec)
                print(f"[ok] wrote {rec['studentId']} — {rec['fullName']} (slot {rec['slotId'] or 'n/a'})")
                written += 1

    print("\n=== Summary ===")
    print(f"Rows read:      {total}")
    print(f"Docs written:   {written}{' (dry run)' if args.dry_run else ''}")
    print(f"Missing IDs:    {missing_id}")
    print(f"Invalid slots:  {invalid_slot}")
    print("Done.")

if __name__ == '__main__':
    main()
