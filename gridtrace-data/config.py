import configparser

config = configparser.ConfigParser()
config.read('/etc/gridtrace/gridtrace-data.conf')

config_auth = configparser.ConfigParser()
config_auth.read('/etc/gridtrace/gridtrace-data-auth.conf')

db_details = {"dbname": config.get('Database', 'name', fallback='gridtrace'),
              "user": config_auth.get('username', fallback='data_aggregator'),
              "password": config_auth.get('password', fallback=''),
              "host": config.get('Database', 'host', fallback='')}
if db_details['password'] == '':
    del db_details['password']
if db_details['host'] == '':
    del db_details['host']

SSDP_WAIT_PERIOD = config.getint('SSDP', 'search interval', fallback=60) #seconds
SSDP_SEARCH_TARGET = config.get('SSDP', 'search target', fallback='urn:gridtrace:service:data-probe:1')
SSDP_MX = config.getint('SSDP', 'search length', fallback=3) #seconds
DATA_PROBE_TTL = config.getint('Data Probe', 'TTL', fallback=300) #seconds
WORKER_REQUEST_PERIOD = config.getint('Data Probe', 'request interval', fallback=60) #seconds
WORKER_RETRY_PERIOD = config.getint('Data Probe', 'request retry interval', fallback=30) #seconds