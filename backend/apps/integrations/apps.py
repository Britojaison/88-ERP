from django.apps import AppConfig
import os


class IntegrationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.integrations'
    verbose_name = 'External Integrations'

    def ready(self):
        # In Django's dev server, ready() is called twice.
        # RUN_MAIN='true' is the reloader child — skip it.
        if os.environ.get('RUN_MAIN') == 'true':
            return

        # Start the scheduler in a background thread so it never blocks
        # the Gunicorn worker from booting (avoids WORKER TIMEOUT).
        import threading

        def _deferred_start():
            try:
                from .scheduler import start_scheduler
                start_scheduler()
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Failed to start Shopify scheduler: {e}")

        threading.Thread(target=_deferred_start, daemon=True).start()
