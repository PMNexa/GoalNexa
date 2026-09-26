from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('goalnexa', '0005_metric_base_value'),
    ]

    operations = [
        migrations.AddField(
            model_name='metric',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
    ]
