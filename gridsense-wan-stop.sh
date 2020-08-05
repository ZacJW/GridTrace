#!/bin/bash
echo "Unlinking WAN Proxy"
out=$(rm /etc/nginx/sites-enabled/gridsense-wan)
if [ $? -ne 0 ]
then
    echo -n $out
else
    echo "Link removed"
fi
echo "Reloading Nginx"
out=$(/usr/sbin/nginx -s reload)
if [ $? -ne 0 ]
then
    echo -n $out
else
    echo "Nginx reloaded"
fi
echo "Stopping freelan"
start-stop-daemon --stop --pid $MAINPID
exit 0
