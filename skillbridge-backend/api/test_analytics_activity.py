from datetime import date

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from .analytics_activity import activity_dates, submission_activity


class ActivityCalendarTests(SimpleTestCase):
    def test_month_is_default_and_week_crosses_month_from_monday(self):
        today = date(2026, 10, 26)
        self.assertEqual(activity_dates({}, today), ('monthly', date(2026, 10, 1), today))
        self.assertEqual(activity_dates({'activity_period': 'weekly'}, date(2026, 3, 1)),
                         ('weekly', date(2026, 2, 23), date(2026, 3, 1)))

    def test_daily_yearly_and_leap_year(self):
        today = date(2024, 2, 29)
        self.assertEqual(activity_dates({'activity_period': 'daily'}, today), ('daily', today, today))
        self.assertEqual(activity_dates({'activity_period': 'yearly'}, today), ('yearly', date(2024, 1, 1), today))

    def test_legacy_custom_urls_and_validation(self):
        today = date(2026, 10, 26)
        self.assertEqual(activity_dates({'date_from': '2026-09-01', 'date_to': '2026-09-30'}, today),
                         ('custom', date(2026, 9, 1), date(2026, 9, 30)))
        for params in [{'activity_period': 'unknown'}, {'activity_period': 'all_time', 'date_from': '2020-01-01'},
                       {'date_from': 'invalid'}, {'date_from': '2026-10-27'},
                       {'date_to': '2026-10-27'}, {'date_from': '2020-01-01'}]:
            with self.subTest(params=params), self.assertRaises(ValidationError):
                activity_dates(params, today)

    def test_yearly_month_buckets_keep_zero_months_and_total(self):
        start, interval, rows = submission_activity({(1, 1, 'saved', date(2026, 2, 10))},
                                                   date(2026, 1, 1), date(2026, 3, 2), 'yearly')
        self.assertEqual(interval, 'month')
        self.assertEqual(rows, [{'date': '2026-01-01', 'submissions': 0},
                                {'date': '2026-02-01', 'submissions': 1},
                                {'date': '2026-03-01', 'submissions': 0}])

    def test_all_time_uses_first_retained_date_and_bounded_buckets(self):
        end = date(2026, 10, 26)
        events = {(1, 1, 'older', date(2000, 5, 15)), (1, 1, 'current', end)}
        start, interval, rows = submission_activity(events, end, end, 'all_time')
        self.assertEqual(start, date(2000, 5, 15))
        self.assertEqual(interval, 'month')
        self.assertLessEqual(len(rows), 361)
        self.assertEqual(sum(row['submissions'] for row in rows), 2)
        start, interval, rows = submission_activity({(1, 1, 'historic', date(1900, 1, 1))}, end, end, 'all_time')
        self.assertEqual(interval, 'year')
        self.assertEqual(len(rows), 127)

    def test_empty_all_time_is_an_honest_zero_today(self):
        end = date(2026, 10, 26)
        self.assertEqual(submission_activity(set(), end, end, 'all_time'),
                         (end, 'day', [{'date': '2026-10-26', 'submissions': 0}]))

    def test_complete_source_events_do_not_expand_a_requested_custom_range(self):
        start, end = date(2026, 10, 1), date(2026, 10, 26)
        events = {(1, 1, 'old', date(2026, 9, 1)), (1, 1, 'current', end),
                  (1, 1, 'future', date(2026, 10, 27))}
        _, _, rows = submission_activity(events, start, end, 'custom')
        self.assertEqual(len(rows), 26)
        self.assertEqual(sum(row['submissions'] for row in rows), 1)
