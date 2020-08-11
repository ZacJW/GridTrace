#!/bin/bash
set -e
if [ $(whoami) != "root" ]
then
    echo "Run as root"
    exit 1
fi
cd /etc/gridtrace/certs
openssl req -config webserver.conf -new -x509 -sha256 -newkey rsa:2048 -nodes -keyout webserver.key -days 365 -out webserver.crt
chown :www-data webserver.key webserver.crt
chmod g+r webserver.key webserver.crt
exit 0
