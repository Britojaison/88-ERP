from django.apps import AppConfig


class MdmConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.mdm'
    verbose_name = 'Master Data Management'

    def ready(self):
        import apps.mdm.signals
