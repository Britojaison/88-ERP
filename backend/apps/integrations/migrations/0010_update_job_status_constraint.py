from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('integrations', '0009_alter_shopifysyncjob_job_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql='''
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shopify_sync_job_job_status_check') THEN
                        ALTER TABLE shopify_sync_job DROP CONSTRAINT shopify_sync_job_job_status_check;
                    END IF;
                END $$;
                ALTER TABLE shopify_sync_job ADD CONSTRAINT shopify_sync_job_job_status_check 
                CHECK (job_status IN ('running', 'completed', 'failed', 'cancelled'));
            ''',
            reverse_sql='''
                ALTER TABLE shopify_sync_job DROP CONSTRAINT IF EXISTS shopify_sync_job_job_status_check;
                ALTER TABLE shopify_sync_job ADD CONSTRAINT shopify_sync_job_job_status_check 
                CHECK (job_status IN ('running', 'completed', 'failed'));
            ''',
        ),
    ]
