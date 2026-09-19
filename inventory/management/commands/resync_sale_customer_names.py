from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import Sale


class Command(BaseCommand):
    help = (
        "Re-stamp each sale's stored customer name from the customer it is linked to. "
        "Repairs sales saved before the name was corrected, e.g. from a POS cart still "
        "holding the old one. Walk-in sales with no linked customer are never touched."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help="List what would change without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Only FK-linked sales: an unlinked walk-in's typed name is all the
        # record there is of who they were, and a customer sharing that name
        # may well be somebody else.
        stale = [
            sale
            for sale in Sale.objects.select_related('customer').exclude(customer=None)
            if sale.customer_name != sale.customer.display_name
        ]

        if not stale:
            self.stdout.write(self.style.SUCCESS("Every linked sale already carries its customer's current name."))
            return

        for sale in stale:
            self.stdout.write(
                f"  {str(sale.id)[:8]}  {sale.customer_name!r} -> {sale.customer.display_name!r}"
            )

        if dry_run:
            self.stdout.write(self.style.WARNING(f"{len(stale)} sale(s) would be updated (dry run, nothing written)."))
            return

        with transaction.atomic():
            for sale in stale:
                sale.customer_name = sale.customer.display_name
                sale.save(update_fields=['customer_name'])

        self.stdout.write(self.style.SUCCESS(f"{len(stale)} sale(s) updated."))
