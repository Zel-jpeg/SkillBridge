"""Calendar ranges and bounded buckets for retained, authorized submission events."""
from collections import Counter
from datetime import date, timedelta

from rest_framework.exceptions import ValidationError


def activity_dates(params, today):
    explicit_dates = bool(params.get('date_from') or params.get('date_to'))
    period = params.get('activity_period') or ('custom' if explicit_dates else 'monthly')
    if period not in {'daily', 'weekly', 'monthly', 'yearly', 'all_time', 'custom'}:
        raise ValidationError({'error': 'Invalid activity_period.'})
    if explicit_dates and period != 'custom':
        raise ValidationError({'error': 'Use Custom dates to combine activity dates with a period.'})
    if period == 'custom':
        try:
            end = date.fromisoformat(params.get('date_to') or today.isoformat())
            start = date.fromisoformat(params.get('date_from') or end.replace(day=1).isoformat())
        except ValueError:
            raise ValidationError({'error': 'Activity dates must use YYYY-MM-DD.'})
        if start > end or (end - start).days > 365 or end > today:
            raise ValidationError({'error': 'Activity range must be ordered, no more than 366 days, and not in the future.'})
    else:
        end = today
        start = (today - timedelta(days=today.weekday()) if period == 'weekly' else
                 today.replace(day=1) if period == 'monthly' else
                 today.replace(month=1, day=1) if period == 'yearly' else today)
    return period, start, end


def submission_activity(events, start, end, period):
    # Events are already authorized, valid and deduplicated by the caller.
    days = Counter(event[3] for event in events if event[3] <= end and (period == 'all_time' or event[3] >= start))
    if period == 'all_time':
        start = min(days, default=end)
    span = (end - start).days
    interval = 'year' if span > 366 * 30 else 'month' if period == 'yearly' or span > 365 else 'day'
    def bucket(day):
        return day.replace(month=1, day=1) if interval == 'year' else day.replace(day=1) if interval == 'month' else day
    counts = Counter()
    for day, count in days.items():
        counts[bucket(day)] += count
    rows = []
    cursor, last = bucket(start), bucket(end)
    while cursor <= last:
        rows.append({'date': cursor.isoformat(), 'submissions': counts[cursor]})
        if interval == 'year':
            if cursor.year == 9999:
                break
            cursor = cursor.replace(year=cursor.year + 1)
        elif interval == 'month':
            if cursor.year == 9999 and cursor.month == 12:
                break
            cursor = date(cursor.year + (cursor.month == 12), cursor.month % 12 + 1, 1)
        else:
            if cursor == last:
                break
            cursor += timedelta(days=1)
    return start, interval, rows
