#!/bin/bash
cd /home/pi/GridSense/
. GridSenseEnv/bin/activate
uwsgi --ini gridsense.ini
