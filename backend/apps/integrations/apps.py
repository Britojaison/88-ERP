from django.apps import AppConfig
import os


class IntegrationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations'
    verbose_name = 'External Integrations'

    def ready(self):
        # Only start the scheduler in the main process.
        # In Django's dev server, `ready()` is called twice (once for the reloader child).
        # RUN_MAIN is set only in the reloader child, so we skip startup there.
        # In production (Gunicorn), RUN_MAIN is not set, so it starts normally.
        if os.environ.get('RUN_MAIN') == 'true':
            # Dev server reloader child process — skip (main process will start it)
            return

        try:
            from .scheduler import start_scheduler
            start_scheduler()
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Failed to start Shopify scheduler: {e}")
