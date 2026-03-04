# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class MdmSku(models.Model):
    id = models.UUIDField(primary_key=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    version = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey('MdmUser', models.DO_NOTHING, blank=True, null=True)
    updated_by = models.ForeignKey('MdmUser', models.DO_NOTHING, related_name='mdmsku_updated_by_set', blank=True, null=True)
    company = models.ForeignKey('MdmCompany', models.DO_NOTHING)
    code = models.CharField(unique=True, max_length=100)
    name = models.CharField(max_length=255)
    product = models.ForeignKey('MdmProduct', models.DO_NOTHING)
    style = models.ForeignKey('MdmStyle', models.DO_NOTHING, blank=True, null=True)
    base_price = models.DecimalField(max_digits=15, decimal_places=2)
    cost_price = models.DecimalField(max_digits=15, decimal_places=2)
    weight = models.DecimalField(max_digits=10, decimal_places=3, blank=True, null=True)
    is_serialized = models.BooleanField(blank=True, null=True)
    is_batch_tracked = models.BooleanField(blank=True, null=True)
    size = models.CharField(max_length=50, blank=True, null=True)
    lifecycle_status = models.CharField(max_length=20)
    is_best_seller = models.BooleanField()
    min_stock_level = models.DecimalField(max_digits=15, decimal_places=3)
    movement_classification = models.CharField(max_length=10)

    class Meta:
        managed = False
        db_table = 'mdm_sku'
        db_table_comment = 'Stock Keeping Unit - sellable items. Inventory always references SKU, never Product'
