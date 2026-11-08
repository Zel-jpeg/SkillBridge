from django.db import migrations, models


# Draft context from the existing IC titles, tags and numerical requirements.
# Coordinators can review and edit these descriptions in the position form.
IC_DESCRIPTIONS = {
    'Frontend Developer': (
        'Build and maintain responsive browser interfaces using JavaScript, React components and CSS. '
        'Handle interface events, connect screens to web services and check browser compatibility. '
        'Use version control and development tools to review changes and troubleshoot interface issues.'
    ),
    'Backend': (
        'Support server-side application development, data storage and service integration. '
        'Apply programming and database knowledge to implement and troubleshoot application services. '
        'Work with networking, operating systems, cloud services, version control and deployment tools '
        'to support reliable application operation.'
    ),
    'Frontend Web Developer Intern': (
        'Assist with web interfaces using HTML, CSS, JavaScript and React. '
        'Implement responsive layouts, connect interface features to web APIs and test browser behavior. '
        'Apply programming fundamentals, debugging and Git to maintain reviewed interface changes.'
    ),
    'Database Support Intern': (
        'Assist with relational database design, SQL queries and database maintenance. '
        'Review table relationships, normalization, indexing and data integrity using tools such as '
        'PostgreSQL or MySQL. Use basic programming and debugging to support data-processing tasks.'
    ),
    'IT Network Specialist Intern': (
        'Assist with configuring and troubleshooting network connections and devices. '
        'Apply TCP/IP, subnetting, routing, switching, LAN and WAN concepts to diagnose connectivity issues. '
        'Support firewall checks and document network findings, with basic web knowledge for related services.'
    ),
    'LGU Database Encoder & Administrator': (
        'Encode, validate and update administrative records accurately. '
        'Check duplicate entries, process forms and maintain consistent relational data. '
        'Support SQL queries, indexing and backup tasks while handling records confidentially '
        'and using basic web and network knowledge for the supporting systems.'
    ),
}


def populate_ic_descriptions(apps, schema_editor):
    positions = apps.get_model('api', 'Position').objects.using(schema_editor.connection.alias)
    shared_ic = positions.filter(management_program_id__isnull=True,
                                eligibility_configured_at__isnull=True, description='')
    for title, description in IC_DESCRIPTIONS.items():
        shared_ic.filter(title=title).update(description=description)


class Migration(migrations.Migration):
    dependencies = [('api', '0041_organization_banner_colors')]

    operations = [
        migrations.AddField(model_name='position', name='description',
                            field=models.TextField(blank=True, default='', db_default='')),
        migrations.RunPython(populate_ic_descriptions, migrations.RunPython.noop),
    ]
