from ssdpy import SSDPClient
client = SSDPClient()
import threading, time
import psycopg2, psycopg2.sql

db_details = {"dbname":"gridsense", "user":"data_aggregator", "password":"ErL8xakHT4rxUpUG", "host":"localhost"}
SSDP_WAIT_PERIOD = 10 #seconds
SSDP_SEARCH_TARGET = "urn:grid-sense:service:data-probe:1"
SSDP_MX = 3 #seconds
DATA_PROBE_TTL = 40 #seconds
WORKER_REQUEST_PERIOD = 15 # seconds
WORKER_RETRY_PERIOD = 5

data_probes = {}

print_lock = threading.Lock()

class Data_Probe(threading.Thread):
    def __init__(self, ip_address, port, location, usn):
        super().__init__()
        self.ip_address = ip_address
        self.port = port
        self.location = location
        self.usn = usn
        self.ttl = time.time() + DATA_PROBE_TTL
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.conn = psycopg2.connect(**db_details)
        super().__init__()

    def refresh(self, ip_address, port, location):
        with self.lock:
            self.ip_address = ip_address
            self.port = port
            self.location = location
        self.ttl = time.time() + DATA_PROBE_TTL

    def run(self):
        import requests, defusedxml.ElementTree
        from collections import namedtuple
        while not self.stop_event.isSet():
            try:
                with self.lock:
                    ip_address = self.ip_address
                    port = self.port
                    location = self.location
                if port == 80:
                    protocol = "http://"
                else:
                    protocol = "https://"
                schema_response = requests.get(protocol + ip_address + "/" + location)
                if schema_response.ok:
                    schema = defusedxml.ElementTree.fromstring(schema_response.text)
                else:
                    self.stop_event.wait(timeout=WORKER_RETRY_PERIOD)
                    continue

                data_url = protocol + ip_address + "/" + schema[2][2].text
                data_response = requests.get(data_url)
                if data_response.ok and data_response.headers.get("Content-type", "").startswith("application/json"):
                    with print_lock:
                        print(usn, data_response.json())
                    cur = self.conn.cursor()
                    for table, data in data_response.json().items():
                        columns = [column["name"] for column in data["columns"]]
                        query = psycopg2.sql.SQL("INSERT INTO {table} ({columns}) VALUES ({data})").format(
                            table=psycopg2.sql.Identifier(table),
                            columns=psycopg2.sql.SQL(", ").join(map(psycopg2.sql.Identifier, columns)),
                            data=psycopg2.sql.SQL(", ").join(psycopg2.sql.Placeholder() * len(columns))
                        )
                        for datapoint in data["values"]:
                            try:
                                cur.execute(query, datapoint)
                            except Exception as e:
                                self.conn.rollback()
                                with print_lock:
                                    print(e)
                                self.stop_event.wait(timeout=WORKER_RETRY_PERIOD)
                                continue
                    self.conn.commit()
                    self.stop_event.wait(timeout=WORKER_REQUEST_PERIOD)
                else:
                    self.stop_event.wait(timeout=WORKER_RETRY_PERIOD)
            except Exception as e:
                with print_lock:
                    print(e)
                self.stop_event.wait(timeout=WORKER_RETRY_PERIOD)
        self.conn.close()


    def is_expired(self):
        return time.time() > self.ttl
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