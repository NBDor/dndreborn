# Generated by Django 3.2 on 2021-06-17 09:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0008_skill_isexpert'),
    ]

    operations = [
        migrations.AddField(
            model_name='skill',
            name='mod',
            field=models.CharField(default='N/A', max_length=100),
        ),
    ]