# Generated by Django 3.2 on 2021-06-17 12:56

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0009_skill_mod'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='skill',
            name='character',
        ),
        migrations.AddField(
            model_name='skill',
            name='characters',
            field=models.ManyToManyField(to='main.Character'),
        ),
    ]
