import threading
import psycopg2, psycopg2.sql, configparser
from .config import *

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