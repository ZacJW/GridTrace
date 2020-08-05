#!/bin/bash
echo "Linking WAN Proxy"
out=$(ln -s /etc/nginx/sites-available/gridsense-wan /etc/nginx/sites-enabled/)
if [ $? -ne 0 ]
then
    echo -n $out
else
    echo "Link created"
fi
sleep 2s
echo "Reloading Nginx"
out=$(/usr/sbin/nginx -s reload)
if [ $? -ne 0 ]
then
    echo -n $out
else
    echo "Nginx reloaded"
fi
exit 0
