#!/bin/bash
source /opt/venvs/gridsense/bin/activate
uwsgi --ini /etc/gridsense/gridsense.ini
