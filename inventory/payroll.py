"""
Month-end salary calculation from attendance and holidays.

Rules
-----
* Scheduled day: a day in the month on one of the employee's working weekdays
  that isn't a holiday. Holidays never count as an absence.
* Each attendance status counts part of the day as worked; the rest is leave,
  paid or unpaid per the record's is_paid flag:
      PRESENT 1 · SHORT_LEAVE 0.75 · HALF_DAY 0.5 · ABSENT 0
* A scheduled day with nothing marked counts as present, and is reported as
  "unmarked" (only up to today) so it can be checked before paying.
* Being marked present (or half / short) on a holiday or a day off is an
  extra day, paid at the day value on top.
* Daily-paid: day value = their rate. Earnings = rate x (worked + paid leave
  + extra days + holidays on their working days that are ticked as paid).
* Monthly-paid: day value = salary / the month's scheduled days. A full month
  earns exactly the salary; unpaid leave and days before they joined are taken
  off at the day value, extra days added at it. Holidays never reduce it.
* EPF (registered employees only): 8% of earnings deducted from the employee;
  employer pays 12% EPF + 3% ETF on top (shown, not deducted).
"""
import calendar
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.utils import timezone

WORKED_FRACTION = {
    'PRESENT': Decimal('1'),
    'SHORT_LEAVE': Decimal('0.75'),
    'HALF_DAY': Decimal('0.5'),
    'ABSENT': Decimal('0'),
}

EPF_EMPLOYEE_RATE = Decimal('0.08')
EPF_EMPLOYER_RATE = Decimal('0.12')
ETF_EMPLOYER_RATE = Decimal('0.03')

CENT = Decimal('0.01')


def _money(value):
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def _working_weekdays(employee):
    return set(employee.working_days or [])


def month_days(year, month):
    return [date(year, month, d) for d in range(1, calendar.monthrange(year, month)[1] + 1)]


def calculate_payroll(employee, year, month, attendance_by_date, holidays_by_date, today=None):
    """
    Work out one employee's pay for a month.

    attendance_by_date: {date: Attendance} for this employee and month.
    holidays_by_date:   {date: Holiday} for the month.
    Returns a dict of Payroll field values.
    """
    today = today or timezone.localdate()
    weekdays = _working_weekdays(employee)
    joined = employee.date_joined

    full_month_scheduled = 0   # scheduled days ignoring the join date
    scheduled = 0              # scheduled days while employed
    worked = paid_leave = unpaid_leave = extra = uninformed = Decimal('0')
    holidays = paid_holidays = unmarked = 0

    for day in month_days(year, month):
        is_working_weekday = day.strftime('%A') in weekdays
        holiday = holidays_by_date.get(day)
        if is_working_weekday and not holiday:
            full_month_scheduled += 1
        if joined and day < joined:
            continue

        att = attendance_by_date.get(day)
        fraction = WORKED_FRACTION.get(att.status, Decimal('0')) if att else Decimal('0')

        if holiday or not is_working_weekday:
            if holiday and is_working_weekday:
                holidays += 1
                if holiday.is_paid:
                    paid_holidays += 1
            extra += fraction
            continue

        scheduled += 1
        if att is None:
            worked += 1
            if day <= today:
                unmarked += 1
            continue

        worked += fraction
        leave = Decimal('1') - fraction
        if leave > 0:
            if att.is_paid:
                paid_leave += leave
            else:
                unpaid_leave += leave
            if att.informed is False:
                uninformed += leave

    rate = Decimal(str(employee.salary_rate or 0))
    if employee.salary_type == 'MONTHLY':
        day_value = rate / full_month_scheduled if full_month_scheduled else Decimal('0')
        not_employed = full_month_scheduled - scheduled
        earnings = rate - (not_employed + unpaid_leave - extra) * day_value
        if scheduled == 0 and extra == 0:
            earnings = Decimal('0')
    else:
        day_value = rate
        earnings = rate * (worked + paid_leave + extra + paid_holidays)

    earnings = max(_money(earnings), Decimal('0.00'))
    if employee.epf_registered:
        epf_employee = _money(earnings * EPF_EMPLOYEE_RATE)
        epf_employer = _money(earnings * EPF_EMPLOYER_RATE)
        etf_employer = _money(earnings * ETF_EMPLOYER_RATE)
    else:
        epf_employee = epf_employer = etf_employer = Decimal('0.00')

    return {
        'scheduled_days': scheduled,
        'days_worked': worked,
        'paid_leave_days': paid_leave,
        'unpaid_leave_days': unpaid_leave,
        'holidays': holidays,
        'paid_holidays': paid_holidays,
        'extra_days': extra,
        'unmarked_days': unmarked,
        'uninformed_absences': uninformed,
        'day_value': _money(day_value),
        'earnings': earnings,
        'epf_employee': epf_employee,
        'epf_employer': epf_employer,
        'etf_employer': etf_employer,
        # Legacy summary columns.
        'days_present': worked,
        'days_paid_leave': paid_leave,
        'days_absent': unpaid_leave,
        'base_salary': earnings,
    }
