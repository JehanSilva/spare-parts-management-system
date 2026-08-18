"""
Bulk-create repair service prices.

Edit the PRICES list below, then run:

    source .venv/bin/activate
    python manage.py shell < seed_repair_services.py

Safe to re-run: an existing service (matched case-insensitively) has its price
updated rather than being duplicated. Delete this file when you're done.
"""

PRICES = [
    # ("Name of the repair",                    price),
    ("Bearing replacement",                       400),
    ("Brake pad replacement",                    4500),
    ("Replacing lower arm bush",                 1600),
    ("Changing wiper blades",                     450),
    ("Replacing air filter",                      450),
    ("Changing ignition coil",                   4000),
    ("Front shock absorber repair L/R",          8000),
    ("Wheel alignment",                          1500),
    ("Oil change",                                800),
]

from inventory.models import RepairService

created = updated = 0
for name, price in PRICES:
    name = name.strip()
    existing = RepairService.objects.filter(name__iexact=name).first()
    if existing:
        existing.default_price = price
        existing.is_active = True
        existing.save()
        updated += 1
        print(f"  updated  {name:<40} {price:>10,.2f}")
    else:
        RepairService.objects.create(name=name, default_price=price)
        created += 1
        print(f"  created  {name:<40} {price:>10,.2f}")

print(f"\n{created} created, {updated} updated. Total in catalog: {RepairService.objects.count()}")
