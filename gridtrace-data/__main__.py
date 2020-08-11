from ssdpy import SSDPClient
client = SSDPClient()
import time
from .__init__ import *
from .config import *

data_probes = {}

try:
    while True:
        loop_start_time = time.time()
        devices = client.m_search(SSDP_SEARCH_TARGET, SSDP_MX)
        for device in devices:
            if  not device['location'].startswith("http://"):
                continue
            usn = device['usn']
            location_partition = device['location'][7:].partition(':')
            ip_address = location_partition[0]
            port = int(location_partition[2].partition("/")[0])
            location = location_partition[2].partition("/")[2]
            if usn in data_probes:
                data_probes[usn].refresh(ip_address, port, location)
            else:
                with print_lock:
                    print("Added device with USN:", usn)
                data_probe = Data_Probe(ip_address, port, location, usn)
                data_probes[usn] = data_probe
                data_probe.start()
        while (time.time() < loop_start_time + SSDP_WAIT_PERIOD):
            expired = []
            for usn, data_probe in data_probes.items():
                if data_probe.is_expired():
                    with print_lock:
                        print("usn", usn, "expired")
                    data_probe.stop_event.set()
                    data_probe.join()
                    expired.append(usn)
            for usn in expired:
                with print_lock:
                    print("Removed device with USN:", usn)
                del data_probes[usn]
            time.sleep(1)
except KeyboardInterrupt:
    for data_probe in data_probes.values():
        data_probe.stop_event.set()
        data_probe.join()