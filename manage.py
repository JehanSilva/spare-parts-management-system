#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    # Monkey-patch platform to prevent WMI query hang on Windows when importing packages (e.g. cloudinary)
    import sys
    if sys.platform == 'win32':
        import platform
        from collections import namedtuple
        platform.platform = lambda *args, **kwargs: "Windows"
        uname_result = namedtuple('uname_result', ['system', 'node', 'release', 'version', 'machine', 'processor'])
        platform.uname = lambda: uname_result("Windows", "localhost", "10", "10.0", "AMD64", "Intel")

    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
