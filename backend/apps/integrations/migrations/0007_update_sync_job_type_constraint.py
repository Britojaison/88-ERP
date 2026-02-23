from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0006_add_job_status_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE shopify_sync_job DROP CONSTRAINT IF EXISTS shopify_sync_job_job_type_check;
                ALTER TABLE shopify_sync_job ADD CONSTRAINT shopify_sync_job_job_type_check
                    CHECK (job_type IN ('products', 'inventory', 'orders', 'draft_orders', 'discounts', 'gift_cards', 'full_sync'));
            """,
            reverse_sql="""
                ALTER TABLE shopify_sync_job DROP CONSTRAINT IF EXISTS shopify_sync_job_job_type_check;
                ALTER TABLE shopify_sync_job ADD CONSTRAINT shopify_sync_job_job_type_check
                    CHECK (job_type IN ('products', 'inventory', 'orders', 'full_sync'));
            """,
        ),
    ]
