from django.contrib import admin
from .models import NumberingSequence, NumberingCounter


@admin.register(NumberingSequence)
class NumberingSequenceAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'format_pattern', 'company', 'status']
    search_fields = ['code', 'name']
    list_filter = ['company', 'status']


@admin.register(NumberingCounter)
class NumberingCounterAdmin(admin.ModelAdmin):
    list_display = ['sequence', 'year', 'month', 'location', 'current_value']
    list_filter = ['sequence', 'year']
    readonly_fields = ['sequence', 'year', 'month', 'location', 'current_value']
