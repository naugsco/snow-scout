#!/usr/bin/env python3
"""Extract reviewed Snow Scout resort mappings from an OpenSkiData snapshot.

Download the official files at most once per UTC day using --download. Large
source files stay in --source-dir; only compact resort subsets are published.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import gzip
import json
import math
from pathlib import Path
import re
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://tiles.openskimap.org/'
ATTRIBUTION = ("Data from OpenSkiData / OpenSkiMap.org, © OpenStreetMap contributors "
               "(ODbL), Skimap.org, Who's On First, © Mapterhorn")


def slug(name):
    name = re.sub(r'\(.*?\)', '', name.lower()).replace('&', 'and')
    return re.sub(r'[^a-z0-9]+', '-', name).strip('-')


def iter_features(path):
    """Read the publisher's feature-per-line GeoJSON without loading a GB in RAM.

    Treat a changed export format as an error rather than silently skipping data.
    """
    with Path(path).open() as stream:
        header = re.sub(r'\s+', '', stream.readline())
        if header != '{"type":"FeatureCollection","features":[':
            raise ValueError(f'{path}: unrecognized GeoJSON export header')
        expect_feature = True
        count = 0
        for number, line in enumerate(stream, 2):
            text = line.strip()
            if text == ',':
                if expect_feature:
                    raise ValueError(f'{path}:{number}: unexpected separator')
                expect_feature = True
            elif text == ']}':
                if expect_feature and count:
                    raise ValueError(f'{path}:{number}: trailing separator')
                if stream.read().strip():
                    raise ValueError(f'{path}: data after FeatureCollection')
                return
            elif text:
                if not expect_feature:
                    raise ValueError(f'{path}:{number}: missing separator')
                feature = json.loads(text)
                if feature.get('type') != 'Feature':
                    raise ValueError(f'{path}:{number}: expected a Feature')
                yield feature
                expect_feature = False
                count += 1
        raise ValueError(f'{path}: truncated FeatureCollection')


def download_snapshot(folder):
    folder.mkdir(parents=True, exist_ok=True)
    state_file = folder / 'download-state.json'
    state = json.loads(state_file.read_text()) if state_file.exists() else {}
    today = datetime.now(timezone.utc).date().isoformat()
    files = [('metadata.json', 'metadata.json'), ('ski_areas.geojson', 'geojson/ski_areas.geojson'),
             ('runs.geojson', 'geojson/runs.geojson'), ('lifts.geojson', 'geojson/lifts.geojson')]
    for name, remote in files:
        path = folder / name
        attempt = state.get(name, {})
        if attempt.get('date') == today:
            if not attempt.get('complete') or not path.is_file():
                raise ValueError(f'{name} was already requested today but did not complete; wait until the next UTC day')
            print(f'Using today\'s cached {name}', flush=True)
            continue
        # Persist the attempt before connecting, honoring the daily download limit
        # even if a request fails. A failed download never replaces a valid file.
        state[name] = {'date': today, 'complete': False}
        state_file.write_text(json.dumps(state, indent=2) + '\n')
        request = urllib.request.Request(SOURCE + remote, headers={
            'User-Agent': 'SnowScout/1.0 (+https://naugsco.github.io/snow-scout/)',
            'Accept-Encoding': 'gzip',
        })
        temporary = path.with_suffix(path.suffix + '.part')
        with urllib.request.urlopen(request, timeout=180) as response, temporary.open('wb') as output:
            source = gzip.GzipFile(fileobj=response) if response.headers.get('Content-Encoding') == 'gzip' else response
            shutil.copyfileobj(source, output)
        temporary.replace(path)
        state[name]['complete'] = True
        state_file.write_text(json.dumps(state, indent=2) + '\n')
        print(f'Downloaded {name}: {path.stat().st_size:,} bytes', flush=True)


def resolve_areas(features, mappings):
    by_source = defaultdict(list)
    by_id = {}
    for feature in features:
        properties = feature['properties']
        by_id[properties['id']] = feature
        for source in properties['sources']:
            by_source[(source['type'], str(source['id']))].append(properties)
    resolved = {}
    for name, mapping in mappings.items():
        selected = []
        for source in mapping['areas']:
            matches = [area for area in by_source[(source['type'], str(source['id']))]
                       if area['name'] == source['name'] and area['status'] == 'operating'
                       and 'downhill' in area['activities']]
            if len(matches) != 1:
                raise ValueError(f'{name}: expected one reviewed match for {source}, got {len(matches)}')
            selected.append(matches[0]['id'])
        if not selected or len(set(selected)) != len(selected):
            raise ValueError(f'{name}: empty or repeated ski-area mapping')
        resolved[name] = selected
    return by_id, resolved


def line_features(feature, kind):
    properties = feature['properties']
    if properties['status'] != 'operating':
        return []
    if kind == 'trail' and 'downhill' not in properties['uses']:
        return []
    if kind == 'lift' and properties.get('liftType') in ('zip_line', 'goods'):
        return []
    geometry = feature['geometry']
    if geometry['type'] in ('Polygon', 'MultiPolygon', 'Point', 'MultiPoint'):
        return []  # An area outline is not a trail centerline.
    if geometry['type'] not in ('LineString', 'MultiLineString'):
        raise ValueError(f'Unsupported route geometry: {geometry["type"]}')
    lines = [geometry['coordinates']] if geometry['type'] == 'LineString' else geometry['coordinates']
    result = []
    for index, line in enumerate(lines):
        if len(line) < 2:
            raise ValueError(f'{properties["id"]}: route needs at least two positions')
        coordinates = []
        elevations = []
        for point in line:
            lon, lat = point[:2]
            if not (math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90):
                raise ValueError(f'{properties["id"]}: invalid coordinate')
            pair = [round(lon, 7), round(lat, 7)]
            if not coordinates or coordinates[-1] != pair:
                coordinates.append(pair)
            if len(point) > 2 and point[2] is not None and math.isfinite(point[2]):
                elevations.append(point[2])
        if len(coordinates) < 2 or coordinates[0] == coordinates[-1]:
            continue
        result.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': coordinates},
                       'properties': {
                           'id': properties['id'] + (f'-{index}' if len(lines) > 1 else ''),
                           'name': properties['name'] or properties.get('ref') or '',
                           'kind': kind, 'difficulty': properties.get('difficulty') or 'unknown',
                           'convention': properties.get('difficultyConvention'),
                           'liftType': properties.get('liftType'), 'sources': properties['sources'],
                           'skiAreas': [area['properties']['id'] for area in properties['skiAreas']],
                           'minElevation': min(elevations) if elevations else None,
                           'maxElevation': max(elevations) if elevations else None,
                       }})
    return result


def route_bounds(features):
    coordinates = [point for feature in features for point in feature['geometry']['coordinates']]
    if not coordinates:
        raise ValueError('No route geometry')
    west, south = map(min, zip(*coordinates))
    east, north = map(max, zip(*coordinates))
    center = [(west + east) / 2, (south + north) / 2]
    dx = max((east - west) * .06, 100 / (111000 * math.cos(math.radians(center[1]))))
    dy = max((north - south) * .06, 100 / 111000)
    bounds = [round(west - dx, 7), round(south - dy, 7), round(east + dx, 7), round(north + dy, 7)]
    span = max((east - west) * 111000 * math.cos(math.radians(center[1])), (north - south) * 111000)
    return {'center': [round(v, 7) for v in center], 'bounds': bounds,
            'range': round(max(5000, span * 1.65))}


def build(source_dir, mappings, output_dir, catalog_file):
    metadata = json.loads((source_dir / 'metadata.json').read_text())
    if metadata['formatVersion'].split('.')[0] != '16':
        raise ValueError(f'Review changed OpenSkiData schema {metadata["formatVersion"]}')
    for name, key in [('ski_areas', 'skiAreas'), ('runs', 'runs'), ('lifts', 'lifts')]:
        actual = (source_dir / f'{name}.geojson').stat().st_size
        if actual != metadata['files']['geojson'][key]:
            raise ValueError(f'{name}: file size differs from this build\'s metadata ({actual})')
    areas, resolved = resolve_areas(iter_features(source_dir / 'ski_areas.geojson'), mappings)
    requested = set(area for ids in resolved.values() for area in ids)
    by_area = defaultdict(dict)
    raw_counts = {}
    for filename, kind in [('runs', 'trail'), ('lifts', 'lift')]:
        count = 0
        for feature in iter_features(source_dir / f'{filename}.geojson'):
            count += 1
            membership = {area['properties']['id'] for area in feature['properties']['skiAreas']} & requested
            if not membership:
                continue
            for item in line_features(feature, kind):
                for area in membership:
                    by_area[area][item['properties']['id']] = item
        if count != metadata['counts'][filename]:
            raise ValueError(f'{filename}: expected {metadata["counts"][filename]} features, got {count}')
        raw_counts[filename] = count
        print(f'Read {count:,} {filename}', flush=True)

    generated = {}
    catalog = {}
    for name, ids in resolved.items():
        # Preserve the already approved Whistler snapshot and its visual anchors.
        # This is an explicit mapping choice, never a substitute for a failed import.
        if mappings[name].get('preserveFile'):
            filename = mappings[name]['preserveFile']
            if Path(filename).name != filename or not filename.endswith('.geojson'):
                raise ValueError(f'{name}: invalid preserved snapshot filename')
            snapshot = json.loads((ROOT / 'data/trails' / filename).read_text())
            counts = Counter(f['properties']['kind'] for f in snapshot['features'])
            catalog[slug(name)] = {'name': name, 'file': filename,
                'trails': counts['trail'], 'lifts': counts['lift'],
                **route_bounds(snapshot['features']), 'areas': [{'id': ids[0], 'name': name}],
                'views': [], 'conventions': ['north_america'], 'timestamp': snapshot['timestamp'],
                'note': '', 'source': 'OpenStreetMap / Overpass'}
            continue
        items = {key: feature for area in ids for key, feature in by_area[area].items()}
        features = sorted(items.values(), key=lambda item: (item['properties']['kind'], item['properties']['id']))
        counts = Counter(feature['properties']['kind'] for feature in features)
        if not counts['trail'] or not counts['lift']:
            raise ValueError(f'{name}: missing mapped trails or lifts: {dict(counts)}')
        missing = [areas[area]['properties']['name'] for area in ids if not by_area[area]]
        if missing:
            raise ValueError(f'{name}: selected ski areas have no routes: {missing}')
        frame = route_bounds(features)
        area_ids = set(area for feature in features for area in feature['properties']['skiAreas'])
        views = []
        for area in sorted(area_ids):
            members = [feature for feature in features if area in feature['properties']['skiAreas']]
            if area not in areas:
                raise ValueError(f'{name}: association points to an unknown ski area {area}')
            properties = areas[area]['properties']
            member_count = sum(f['properties']['kind'] == 'trail' for f in members)
            source_count = sum(v['count'] for v in properties['statistics']['runs']['byActivity']
                               .get('downhill', {}).get('byDifficulty', {}).values())
            # A few shared connector lines must not create a misleading resort option.
            if area not in ids and (member_count < 5 or member_count < source_count * .8):
                continue
            views.append({'id': area, 'name': properties['name'], **route_bounds(members)})
        mapped_areas = [{'id': area, 'name': areas[area]['properties']['name'],
                         'sources': areas[area]['properties']['sources']} for area in ids]
        filename = slug(name) + '.geojson'
        snapshot = {'type': 'FeatureCollection', 'name': name,
                    'timestamp': metadata['source']['openStreetMap']['dataTimestamp'],
                    'buildTimestamp': metadata['run']['finishedAt'], 'formatVersion': metadata['formatVersion'],
                    'source': 'https://www.openskidata.org/', 'license': 'ODbL-1.0',
                    'attribution': ATTRIBUTION, 'mappedAreas': mapped_areas, 'features': features}
        generated[filename] = json.dumps(snapshot, separators=(',', ':'), ensure_ascii=False) + '\n'
        conventions = sorted({f['properties']['convention'] for f in features if f['properties']['convention']})
        catalog[slug(name)] = {'name': name, 'file': filename, 'trails': counts['trail'], 'lifts': counts['lift'],
                               **frame, 'areas': mapped_areas, 'views': views, 'conventions': conventions,
                               'timestamp': snapshot['timestamp'], 'note': mappings[name].get('note', ''),
                               'source': 'OpenSkiData'}
        print(f'{name}: {counts["trail"]} trail / {counts["lift"]} lift segments; {len(ids)} mapped areas', flush=True)
    # Prepare the complete extraction before replacing any published files.
    output_dir.mkdir(parents=True, exist_ok=True)
    for filename, text in generated.items():
        (output_dir / filename).write_text(text)
    catalog_file.write_text('// Generated by scripts/import_resort_trails.py; do not edit by hand.\n'
                            'export const TRAIL_CATALOG = ' + json.dumps(catalog, ensure_ascii=False, indent=2) + ';\n')
    print(f'Extracted {len(catalog)} resorts from OpenSkiData {metadata["run"]["finishedAt"]}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--mappings', type=Path, default=ROOT / 'scripts/trail-resorts.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/trails')
    parser.add_argument('--catalog', type=Path, default=ROOT / 'js/trail-catalog.js')
    args = parser.parse_args()
    if args.download:
        download_snapshot(args.source_dir)
    build(args.source_dir, json.loads(args.mappings.read_text())['resorts'], args.output, args.catalog)


if __name__ == '__main__':
    main()
