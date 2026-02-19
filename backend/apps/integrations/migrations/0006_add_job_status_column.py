# Generated manually to fix missing job_status column
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0005_alter_shopifysyncjob_job_type_shopifyorder_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='shopifysyncjob',
            name='job_status',
            field=models.CharField(
                max_length=20,
                db_column='job_status',
                choices=[
                    ('running', 'Running'),
                    ('completed', 'Completed'),
                    ('failed', 'Failed'),
                ],
                default='running'
            ),
        ),
    ]
