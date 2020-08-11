#!/bin/bash
source /opt/venvs/gridtrace/bin/activate
uwsgi --ini /etc/gridtrace/gridtrace.ini
