import re

from django.db import migrations

# A frozen copy of inventory.text.title_case_name, so later changes to that
# rule can't alter what this migration did.
_WORD_START = re.compile(r"(^|[^A-Za-z0-9'’])([a-z])")


def _title_case(text):
    if not text:
        return text
    return _WORD_START.sub(lambda m: m.group(1) + m.group(2).upper(), text.strip())


def title_case_part_names(apps, schema_editor):
    Part = apps.get_model('inventory', 'Part')
    for part in Part.objects.only('id', 'name'):
        new_name = _title_case(part.name)
        if new_name != part.name:
            Part.objects.filter(pk=part.pk).update(name=new_name)


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0046_estimate_show_bank_details'),
    ]

    operations = [
        migrations.RunPython(title_case_part_names, migrations.RunPython.noop),
    ]
