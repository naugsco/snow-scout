#!/usr/bin/env python3
"""Build season snowfall estimates from Open-Meteo's ERA5 archive (1940 onward).

Full history is downloaded once per resort. Later runs recalculate only its current
season, preserving completed seasons. Every total retains dates and day coverage.
No credentials or third-party packages are required.
"""
import argparse
from datetime import date, datetime, timedelta, timezone
import json
import math
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MODEL = 'era5'
FIRST_DAY = date(1940, 1, 1)
SOURCE = 'https://open-meteo.com/en/docs/historical-weather-api'


def resort_key(name):
    text = re.sub(r'\(.*?\)', '', name.lower()).replace('&', 'and')
    return re.sub(r'[^a-z0-9]+', ' ', text).strip()


def app_resorts():
    raw = (ROOT / 'js/constants.js').read_text().split('export const DEFAULT_WEBCAM_PAGES')[0]
    rows = re.findall(r'\{\s*name:\s*"([^"]+)",\s*lat:\s*([-\d.]+),\s*lon:\s*([-\d.]+)', raw)
    results = {}
    for name, lat, lon in rows:
        if name == 'Squaw Valley Alpine Meadows':
            name = 'Palisades Tahoe'
        results.setdefault(resort_key(name), {'name': name, 'lat': float(lat), 'lon': float(lon)})
    if not results:
        raise ValueError('No app resorts found in constants.js')
    return results


def season_bounds(day, southern=False):
    start_year = day.year if southern or day.month >= 7 else day.year - 1
    if southern:
        return str(start_year), date(start_year, 1, 1), date(start_year, 12, 31)
    return f'{start_year}/{str(start_year + 1)[-2:]}', date(start_year, 7, 1), date(start_year + 1, 6, 30)


def aggregate_seasons(payload, start, end, southern=False):
    if payload.get('daily_units', {}).get('snowfall_sum') != 'cm':
        raise ValueError('Expected ERA5 daily snowfall in centimeters')
    daily = payload.get('daily', {})
    dates, snow = daily.get('time', []), daily.get('snowfall_sum', [])
    if len(dates) != len(snow) or not dates:
        raise ValueError('Missing or unequal daily date and snowfall arrays')
    parsed_dates = [date.fromisoformat(day) for day in dates]
    expected = [start + timedelta(days=i) for i in range((end - start).days + 1)]
    if parsed_dates != expected:
        raise ValueError('Archive dates must be consecutive and cover the requested range exactly')
    for value in snow:
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
            raise ValueError(f'Invalid snowfall value: {value}')
    finite_indices = [i for i, value in enumerate(snow) if value is not None]
    if not finite_indices:
        raise ValueError('Archive has no available snowfall values')
    # ERA5 occasionally returns nulls for its latest day. Never count them as zero.
    last = finite_indices[-1]
    available_through = parsed_dates[last]
    grouped = {}
    for day, value in zip(parsed_dates[:last + 1], snow[:last + 1]):
        label, season_start, season_end = season_bounds(day, southern)
        row = grouped.setdefault(label, {'season': label, 'startDate': season_start.isoformat(), 'endDate': season_end.isoformat(), 'through': min(available_through, season_end).isoformat(), 'sumCm': 0, 'observedDays': 0})
        if value is not None:
            row['sumCm'] += value
            row['observedDays'] += 1
    seasons = []
    for row in grouped.values():
        expected_days = (date.fromisoformat(row['through']) - date.fromisoformat(row['startDate'])).days + 1
        row['expectedDays'] = expected_days
        row['missingDays'] = expected_days - row['observedDays']
        row['total'] = round(row.pop('sumCm') / 2.54, 2) if not row['missingDays'] else None
        row['complete'] = row['through'] == row['endDate'] and row['missingDays'] == 0
        seasons.append(row)
    return sorted(seasons, key=lambda row: row['season'], reverse=True), available_through.isoformat()


def request_url(resort, start, end):
    return 'https://archive-api.open-meteo.com/v1/archive?' + urlencode({
        'latitude': resort['lat'], 'longitude': resort['lon'], 'start_date': start.isoformat(),
        'end_date': end.isoformat(), 'daily': 'snowfall_sum', 'models': MODEL, 'timezone': 'GMT'
    })


def fetch_payload(url):
    request = Request(url, headers={'User-Agent': 'SnowScout/1.0 ERA5-season-totals'})
    with urlopen(request, timeout=120) as response:
        payload = json.load(response)
    if payload.get('error'):
        raise ValueError(payload.get('reason', 'Archive API error'))
    return payload


def merge_seasons(previous, fresh):
    merged = {row['season']: row for row in previous}
    merged.update({row['season']: row for row in fresh})
    return sorted(merged.values(), key=lambda row: row['season'], reverse=True)


def save_catalog(output, resorts, generated_at):
    summary = {status: sum(row['status'] == status for row in resorts.values()) for status in ('ok', 'error', 'pending')}
    payload = {'generatedAt': generated_at, 'units': 'in', 'model': MODEL, 'source': 'Open-Meteo / ECMWF ERA5 reanalysis', 'sourceUrl': SOURCE, 'historyStartDate': FIRST_DAY.isoformat(), 'seasonDefinition': 'Northern: July 1–June 30. Southern: January 1–December 31. Days are UTC.', 'summary': summary, 'resorts': dict(sorted(resorts.items()))}
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')
    temporary.replace(output)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/resort-snowfall.json')
    parser.add_argument('--as-of', type=date.fromisoformat, default=datetime.now(timezone.utc).date())
    parser.add_argument('--backfill-budget', type=float, default=1800, help='Maximum estimated archive call units for older data per run')
    parser.add_argument('--chunk-years', type=int, default=10)
    parser.add_argument('--resort', action='append', help='Fetch only this exact resort (repeatable)')
    args = parser.parse_args()
    target = args.as_of - timedelta(days=5)
    if target < FIRST_DAY or args.backfill_budget < 0 or args.chunk_years < 1:
        parser.error('Date or backfill settings are invalid')
    all_resorts = app_resorts()
    requested = {resort_key(name) for name in args.resort} if args.resort else set(all_resorts)
    if requested - all_resorts.keys():
        parser.error('Unknown resort name')
    old = json.loads(args.output.read_text()) if args.output.exists() else {}
    results = old.get('resorts', {}) if old.get('model') == MODEL else {}
    results = {key: results.get(key, {**resort, 'status': 'pending', 'seasons': [], 'sourceUrl': SOURCE}) for key, resort in all_resorts.items()}
    generated_at = datetime.now(timezone.utc).isoformat()
    failures = 0

    def update(key, start, end):
        nonlocal failures
        resort, previous = all_resorts[key], results[key]
        url = request_url(resort, start, end)
        print(f"Fetching {resort['name']}: {start} to {end}", flush=True)
        try:
            payload = fetch_payload(url)
            fresh, through = aggregate_seasons(payload, start, end, resort['lat'] < 0)
            previous_start = previous.get('historyStartDate', start.isoformat())
            results[key] = {**resort, 'status': 'ok', 'sourceUrl': SOURCE, 'apiUrl': url,
                            'retrievedAt': generated_at,
                            'requestedThrough': max(previous.get('requestedThrough', ''), end.isoformat()),
                            'availableThrough': max(previous.get('availableThrough', ''), through),
                            'historyStartDate': min(previous_start, start.isoformat()),
                            'gridElevationM': payload.get('elevation'), 'gridLat': payload.get('latitude'), 'gridLon': payload.get('longitude'),
                            'seasons': merge_seasons(previous['seasons'], fresh)}
            print(f"ok: {resort['name']}: {sum(row['complete'] for row in results[key]['seasons'])} complete seasons", flush=True)
        except Exception as error:
            failures += 1
            results[key] = {**previous, **resort, 'status': 'error', 'lastAttemptAt': generated_at, 'error': f'{type(error).__name__}: {error}'}
            print(f"ERROR: {resort['name']}: {error}", file=sys.stderr, flush=True)
            save_catalog(args.output, results, generated_at)
            if isinstance(error, HTTPError) and error.code == 429:
                print('API rate limit reached; stopped. Rerun later to resume checkpoints.', file=sys.stderr)
                raise
        save_catalog(args.output, results, generated_at)
        # One variable uses 1/10 of the two-week call unit. Keep below 550 units/min.
        weight = max(1, (end - start).days / 14 / 10)
        time.sleep(max(1, weight * 60 / 550))

    try:
        # Current-season coverage gets priority over archive depth.
        for key, resort in all_resorts.items():
            if key not in requested:
                continue
            previous = results[key]
            if previous.get('requestedThrough') == target.isoformat() and previous.get('status') == 'ok':
                continue
            same_location = previous.get('lat') == resort['lat'] and previous.get('lon') == resort['lon']
            if not same_location:
                previous = results[key] = {**resort, 'status': 'pending', 'seasons': [], 'sourceUrl': SOURCE}
            start = season_bounds(target, resort['lat'] < 0)[1]
            if previous.get('availableThrough'):
                start = min(start, season_bounds(date.fromisoformat(previous['availableThrough']), resort['lat'] < 0)[1])
            update(key, start, target)

        # Give resorts with the shortest archives priority. Completed seasons are stored,
        # so repeated scheduled runs progressively reach 1940 without repeating downloads.
        budget = args.backfill_budget
        while True:
            candidates = [(key, row) for key, row in results.items() if key in requested and row.get('status') == 'ok' and row.get('historyStartDate', FIRST_DAY.isoformat()) > FIRST_DAY.isoformat()]
            if not candidates:
                break
            key, previous = max(candidates, key=lambda pair: (pair[1]['historyStartDate'], pair[0]))
            end = date.fromisoformat(previous['historyStartDate']) - timedelta(days=1)
            start = max(FIRST_DAY, date(end.year - args.chunk_years + 1, 1, 1) if all_resorts[key]['lat'] < 0 else date(end.year - args.chunk_years, 7, 1))
            weight = max(1, (end - start).days / 14 / 10)
            if weight > budget:
                break
            update(key, start, end)
            budget -= weight
    except HTTPError as error:
        if error.code != 429:
            raise
    summary = save_catalog(args.output, results, generated_at)
    remaining = sum(row.get('historyStartDate', '9999') > FIRST_DAY.isoformat() for row in results.values())
    print(json.dumps({**summary, 'resortsStillBackfilling': remaining}))
    return 1 if failures or summary['pending'] else 0


if __name__ == '__main__':
    sys.exit(main())
