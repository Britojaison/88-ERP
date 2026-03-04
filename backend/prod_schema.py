# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey and OneToOneField has `on_delete` set to the desired behavior
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
from django.db import models


class MdmProduct(models.Model):
    id = models.UUIDField(primary_key=True)
    status = models.CharField(max_length=20, blank=True, null=True)
    version = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)
    created_by = models.ForeignKey('MdmUser', models.DO_NOTHING, blank=True, null=True)
    updated_by = models.ForeignKey('MdmUser', models.DO_NOTHING, related_name='mdmproduct_updated_by_set', blank=True, null=True)
    company = models.ForeignKey('MdmCompany', models.DO_NOTHING)
    code = models.CharField(max_length=100)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey('self', models.DO_NOTHING, blank=True, null=True)
    image = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'mdm_product'
        unique_together = (('company', 'code'),)
