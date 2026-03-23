import os
from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.utils import timezone
from django.db.models import Sum, F
from inventory.models import Sale, SaleItem, Part
from django.conf import settings

class Command(BaseCommand):
    help = 'Sends a daily summary of sales and low stock alerts to the admin email.'

    def handle(self, *args, **kwargs):
        now = timezone.now()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 1. Today's Sales
        todays_sales = Sale.objects.filter(status='COMPLETED', created_at__gte=start_of_day)
        total_revenue = todays_sales.aggregate(total=Sum('total_amount'))['total'] or 0

        # 2. Today's Profit
        todays_items = SaleItem.objects.filter(sale__status='COMPLETED', sale__created_at__gte=start_of_day)
        total_profit = todays_items.aggregate(
            profit=Sum((F('unit_price') - F('part__buy_price')) * F('quantity'))
        )['profit'] or 0

        # 3. Stock Alerts
        out_of_stock = Part.objects.filter(stock_qty=0)
        low_stock = Part.objects.filter(stock_qty=1)

        # 4. Format Message
        subject = f"NSS Auto Spares - Daily Summary ({now.strftime('%Y-%m-%d')})"
        
        message = f"Daily End of Day Report - {now.strftime('%b %d, %Y')}\n"
        message += "=" * 40 + "\n\n"
        
        message += "💰 FINANCIALS:\n"
        message += f"- Total Revenue Today: LKR {total_revenue:,.2f}\n"
        message += f"- Total Profit Today:  LKR {total_profit:,.2f}\n"
        message += f"- Number of Sales:     {todays_sales.count()}\n\n"

        message += "🚨 CRITICAL STOCK ALERTS:\n"
        message += f"Out of Stock: {out_of_stock.count()} items\n"
        for p in out_of_stock[:10]:
            message += f"  - {p.name} (Part #: {p.part_number})\n"
        if out_of_stock.count() > 10:
            message += "  ... and more.\n"
            
        message += "\n"
        message += f"Low Stock (<= 1): {low_stock.count()} items\n"
        for p in low_stock[:10]:
            message += f"  - {p.name} (Part #: {p.part_number})\n"
        if low_stock.count() > 10:
            message += "  ... and more.\n"

        message += "\n" + "=" * 40 + "\n"
        message += "To view full details, log in to the dashboard."

        admin_emails = getattr(settings, 'ADMIN_EMAILS', ['jehan@nssauto.lk', 'sudharshan@nssauto.lk'])
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'info@nssauto.lk')

        self.stdout.write(f"Preparing to send email to {', '.join(admin_emails)}...")
        
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=admin_emails,
            fail_silently=False,
        )

        self.stdout.write(self.style.SUCCESS(f"Successfully sent daily summary to {', '.join(admin_emails)}!"))
