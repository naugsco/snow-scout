#!/usr/bin/env python3
"""Build a compact passenger-airport catalog from a downloaded OurAirports CSV."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('csv', type=Path)
    args = parser.parse_args()
    raw = args.csv.read_bytes()
    airports = []
    codes = set()
    for row in csv.DictReader(raw.decode('utf-8-sig').splitlines()):
        code = row['iata_code']
        if (row['scheduled_service'] != 'yes' or row['type'] not in ('large_airport', 'medium_airport')
                or len(code) != 3 or not code.isascii() or not code.isalpha()):
            continue
        if code in codes:
            raise ValueError(f'Duplicate passenger airport code: {code}')
        codes.add(code)
        airports.append(dict(code=code, name=row['name'], city=row['municipality'], country=row['iso_country'],
                             lat=float(row['latitude_deg']), lon=float(row['longitude_deg']),
                             size='large' if row['type'] == 'large_airport' else 'medium'))
    if len(airports) < 1000:
        raise ValueError('Unexpectedly small airport catalog; refusing to overwrite')
    payload = dict(source='https://ourairports.com/data/', download='https://ourairports.com/data/airports.csv',
                   license='Public domain', retrievedAt=datetime.now(timezone.utc).isoformat(),
                   sha256=hashlib.sha256(raw).hexdigest(),
                   note='Community-maintained airport locations, not live routes or schedules. Scheduled medium and large airports only.',
                   airports=sorted(airports, key=lambda a: a['code']))
    (ROOT / 'data/travel-airports.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Imported {len(airports)} passenger airports')

if __name__ == '__main__':
    main()
