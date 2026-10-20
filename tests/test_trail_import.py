"""Exercise provenance filtering and explicit failures in the trail importer."""
import contextlib
from datetime import datetime, timezone
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('trail_import', ROOT / 'scripts/import_resort_trails.py')
trails = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(trails)


def area(id, name, osm):
    return {'type': 'Feature', 'properties': {
        'id': id, 'name': name, 'status': 'operating', 'activities': ['downhill'],
        'sources': [{'type': 'openstreetmap', 'id': osm}],
        'statistics': {'runs': {'byActivity': {'downhill': {'byDifficulty': {'easy': {'count': 1}}}}}},
    }, 'geometry': {'type': 'Point', 'coordinates': [-106, 39]}}


def route(id, ski_area, kind='trail', **extra):
    return {'type': 'Feature', 'geometry': {'type': 'LineString',
        'coordinates': [[-106, 39, 3000], [-106.001, 39.001, 3100]]},
        'properties': {'id': id, 'name': id, 'status': 'operating',
            'uses': ['downhill'], 'difficulty': 'easy', 'difficultyConvention': 'north_america',
            'skiAreas': [ski_area], 'sources': [{'type': 'openstreetmap', 'id': 'way/' + id}],
            'liftType': 'chair_lift' if kind == 'lift' else None, **extra}}


def write_export(path, features):
    path.write_text('{"type": "FeatureCollection", "features":[\n' +
                    '\n,\n'.join(json.dumps(f) for f in features) + '\n]}\n')


class TrailImportTests(unittest.TestCase):
    def test_neighboring_routes_cannot_enter_a_resort_and_duplicate_membership_is_deduplicated(self):
        selected = area('selected', 'Vail', 'way/1')
        neighbor = area('neighbor', 'Beaver Creek', 'way/2')
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            runs = [route('1', selected), route('2', neighbor), route('3', selected, uses=['nordic'])]
            runs[0]['properties']['skiAreas'].append(selected)
            lift = route('4', selected, 'lift')
            write_export(folder / 'ski_areas.geojson', [selected, neighbor])
            write_export(folder / 'runs.geojson', runs)
            write_export(folder / 'lifts.geojson', [lift])
            metadata = {'formatVersion': '16.0.0', 'source': {'openStreetMap': {'dataTimestamp': '2026-10-19T01:00:00Z'}},
                'run': {'finishedAt': '2026-10-20T01:00:00Z'}, 'counts': {'runs': 3, 'lifts': 1},
                'files': {'geojson': {key: (folder / f'{filename}.geojson').stat().st_size
                    for filename, key in [('ski_areas','skiAreas'), ('runs','runs'), ('lifts','lifts')]}}}
            (folder / 'metadata.json').write_text(json.dumps(metadata))
            mapping = {'Vail': {'areas': [{'type': 'openstreetmap', 'id': 'way/1', 'name': 'Vail'}]}}
            with contextlib.redirect_stdout(io.StringIO()):
                trails.build(folder, mapping, folder / 'output', folder / 'catalog.js')
            data = json.loads((folder / 'output/vail.geojson').read_text())
            self.assertEqual({f['properties']['id'] for f in data['features']}, {'1','4'})
            self.assertIn('OpenSkiData', data['attribution'])

    def test_missing_or_ambiguous_reviewed_match_raises_instead_of_using_a_nearby_resort(self):
        mapping = {'Vail': {'areas': [{'type': 'openstreetmap', 'id': 'way/1', 'name': 'Vail'}]}}
        with self.assertRaisesRegex(ValueError, 'expected one reviewed match'):
            trails.resolve_areas([area('neighbor','Beaver Creek','way/2')], mapping)
        with self.assertRaisesRegex(ValueError, 'got 2'):
            trails.resolve_areas([area('a','Vail','way/1'), area('b','Vail','way/1')], mapping)

    def test_areas_non_downhill_and_non_operating_routes_are_excluded(self):
        selected = area('selected','Vail','way/1')
        polygon = route('1', selected)
        polygon['geometry'] = {'type': 'Polygon', 'coordinates': [[[-106,39],[-106,39.1],[-106.1,39],[-106,39]]]}
        self.assertEqual(trails.line_features(polygon, 'trail'), [])
        self.assertEqual(trails.line_features(route('2',selected,uses=['nordic']), 'trail'), [])
        self.assertEqual(trails.line_features(route('3',selected,status='abandoned'), 'trail'), [])
        bad = route('4',selected)
        bad['geometry']['coordinates'][0][0] = 181
        with self.assertRaisesRegex(ValueError, 'invalid coordinate'):
            trails.line_features(bad,'trail')

    def test_truncated_export_and_failed_download_attempt_are_not_reused_silently(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            path = folder / 'runs.geojson'
            write_export(path, [route('1',area('a','Vail','way/1'))])
            path.write_text(path.read_text().removesuffix(']}\n'))
            with self.assertRaisesRegex(ValueError, 'truncated'):
                list(trails.iter_features(path))
            (folder / 'metadata.json').write_text('{}')
            (folder / 'download-state.json').write_text(json.dumps({'metadata.json': {
                'date': datetime.now(timezone.utc).date().isoformat(), 'complete': False}}))
            with patch.object(trails.urllib.request, 'urlopen') as connect:
                with self.assertRaisesRegex(ValueError, 'did not complete'):
                    trails.download_snapshot(folder)
                connect.assert_not_called()


if __name__ == '__main__':
    unittest.main()
