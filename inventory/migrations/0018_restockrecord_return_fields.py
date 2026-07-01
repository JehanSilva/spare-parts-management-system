from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0017_restockrecord'),
    ]

    operations = [
        migrations.AddField(
            model_name='restockrecord',
            name='status',
            field=models.CharField(
                choices=[
                    ('ACTIVE', 'Active'),
                    ('PARTIALLY_RETURNED', 'Partially Returned'),
                    ('FULLY_RETURNED', 'Fully Returned'),
                ],
                default='ACTIVE',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='restockrecord',
            name='returned_quantity',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='restockrecord',
            name='return_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='restockrecord',
            name='returned_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
