import importlib.util
from datetime import date, timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('snowfall', Path(__file__).resolve().parents[1] / 'scripts/fetch_resort_snowfall.py')
snowfall = importlib.util.module_from_spec(spec)
spec.loader.exec_module(snowfall)


def payload(start, end, amount=2.54):
    dates = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
    return {'daily_units': {'snowfall_sum': 'cm'}, 'daily': {'time': dates, 'snowfall_sum': [amount] * len(dates)}}


class SnowfallTests(unittest.TestCase):
    def test_requests_use_forecast_terrain_points_not_base_villages(self):
        resorts = snowfall.app_resorts()
        palisades, whistler = resorts['palisades tahoe'], resorts['whistler blackcomb']
        points = snowfall.weather_locations()
        self.assertEqual((palisades['lat'], palisades['lon']), (points['Palisades Tahoe']['lat'], points['Palisades Tahoe']['lon']))
        self.assertNotIn('elevation=', snowfall.request_url(palisades, date(2026, 7, 1), date(2026, 7, 2)))
        self.assertEqual(whistler['elevationM'], 1850)
        self.assertIn('elevation=1850', snowfall.request_url(whistler, date(2026, 7, 1), date(2026, 7, 2)))
        self.assertEqual(len(resorts), len(points))

    def test_northern_season_and_leap_day(self):
        start, end = date(2023, 7, 1), date(2024, 6, 30)
        rows, through = snowfall.aggregate_seasons(payload(start, end), start, end)
        self.assertEqual(rows[0]['season'], '2023/24')
        self.assertEqual(rows[0]['total'], 366)
        self.assertTrue(rows[0]['complete'])
        self.assertEqual(through, '2024-06-30')

    def test_southern_calendar_year(self):
        start, end = date(2024, 1, 1), date(2024, 12, 31)
        rows, _ = snowfall.aggregate_seasons(payload(start, end), start, end, southern=True)
        self.assertEqual(rows[0]['season'], '2024')
        self.assertEqual(rows[0]['total'], 366)
        self.assertTrue(rows[0]['complete'])

    def test_missing_day_never_becomes_zero(self):
        start, end = date(2024, 1, 1), date(2024, 12, 31)
        data = payload(start, end)
        data['daily']['snowfall_sum'][10] = None
        rows, _ = snowfall.aggregate_seasons(data, start, end, southern=True)
        self.assertIsNone(rows[0]['total'])
        self.assertFalse(rows[0]['complete'])
        self.assertEqual(rows[0]['missingDays'], 1)

    def test_archive_delay_has_explicit_cutoff(self):
        start, end = date(2026, 7, 1), date(2026, 7, 3)
        data = payload(start, end)
        data['daily']['snowfall_sum'][-1] = None
        rows, through = snowfall.aggregate_seasons(data, start, end)
        self.assertEqual(through, '2026-07-02')
        self.assertEqual(rows[0]['through'], through)
        self.assertEqual(rows[0]['total'], 2)
        self.assertFalse(rows[0]['complete'])

    def test_partial_first_year_is_not_complete(self):
        start, end = date(1940, 1, 1), date(1940, 6, 30)
        rows, _ = snowfall.aggregate_seasons(payload(start, end), start, end)
        self.assertFalse(rows[0]['complete'])
        self.assertIsNone(rows[0]['total'])

    def test_zero_is_valid_and_negative_values_are_rejected(self):
        start = end = date(2026, 7, 1)
        rows, _ = snowfall.aggregate_seasons(payload(start, end, 0), start, end)
        self.assertEqual(rows[0]['total'], 0)
        with self.assertRaises(ValueError):
            snowfall.aggregate_seasons(payload(start, end, -1), start, end)

    def test_wrong_units_and_missing_dates_are_rejected(self):
        start, end = date(2026, 7, 1), date(2026, 7, 3)
        data = payload(start, end)
        data['daily_units']['snowfall_sum'] = 'mm'
        with self.assertRaises(ValueError):
            snowfall.aggregate_seasons(data, start, end)
        data = payload(start, end)
        data['daily']['time'].pop()
        data['daily']['snowfall_sum'].pop()
        with self.assertRaises(ValueError):
            snowfall.aggregate_seasons(data, start, end)

    def test_incremental_season_replacement_does_not_double_count(self):
        old = [{'season': '2024/25', 'total': 200}, {'season': '2025/26', 'total': 50}]
        fresh = [{'season': '2025/26', 'total': 75}]
        merged = snowfall.merge_seasons(old, fresh)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]['total'], 75)
        self.assertEqual(merged[1]['total'], 200)

    def run_main(self, fetch, resorts):
        calls = []
        def fake_fetch(url):
            calls.append(url)
            return fetch(len(calls))
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'snowfall.json'
            argv = ['fetch', '--output', str(output), '--as-of', '2026-11-21', '--backfill-budget', '0']
            for name in resorts:
                argv += ['--resort', name]
            with mock.patch.object(snowfall, 'fetch_payload', fake_fetch), mock.patch.object(snowfall.time, 'sleep'), mock.patch.object(sys, 'argv', argv):
                code = snowfall.main()
            return code, calls, json.loads(output.read_text())

    def test_stops_after_consecutive_network_errors_and_keeps_checkpoints(self):
        names = ['Vail', 'Alta', 'Aspen Snowmass', 'Big Sky', 'Snowbird']
        def fetch(n):
            if n == 1:
                return payload(date(2026, 7, 1), date(2026, 11, 16))
            raise URLError('_ssl.c:994: The handshake operation timed out')
        code, calls, saved = self.run_main(fetch, names)
        self.assertEqual(code, 1)
        self.assertEqual(len(calls), 1 + snowfall.MAX_CONSECUTIVE_NETWORK_ERRORS)
        statuses = sorted(row['status'] for row in saved['resorts'].values() if row['name'] in names)
        self.assertEqual(statuses.count('ok'), 1)
        self.assertEqual(statuses.count('error'), 3)

    def test_scattered_network_errors_do_not_stop_the_run(self):
        names = ['Vail', 'Alta', 'Aspen Snowmass', 'Big Sky', 'Snowbird']
        def fetch(n):
            if n % 2 == 0:
                raise URLError('handshake timed out')
            return payload(date(2026, 7, 1), date(2026, 11, 16))
        code, calls, _ = self.run_main(fetch, names)
        self.assertEqual((code, len(calls)), (1, 5))

    def test_http_errors_other_than_429_are_not_counted_as_network_errors(self):
        self.assertTrue(snowfall.is_network_error(URLError('x')))
        self.assertTrue(snowfall.is_network_error(TimeoutError()))
        self.assertFalse(snowfall.is_network_error(HTTPError('u', 500, 'x', {}, None)))
        self.assertFalse(snowfall.is_network_error(ValueError('x')))


if __name__ == '__main__':
    unittest.main()
