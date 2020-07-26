from flask import Flask, render_template, url_for, request, abort, jsonify, redirect
import psycopg2, psycopg2.extensions, psycopg2.extras, datetime
app = Flask(__name__)

conn = psycopg2.connect("dbname=gridsense user=gridsense")
conn.set_session(autocommit=True, readonly=True)

def data_api_db_range(data, start=None, end=None):
    cur = conn.cursor()
    if data == 'voltage':
        if start is not None:
            if end is not None:
                cur.execute("SELECT date_time, cell_id, millivolts FROM cell_voltage WHERE date_time BETWEEN %s and %s ORDER BY date_time ASC", (start, end))
            else:
                cur.execute("SELECT date_time, cell_id, millivolts FROM cell_voltage WHERE date_time >= %s ORDER BY date_time ASC", (start,))
        else:
            if end is not None:
                cur.execute("SELECT date_time, cell_id, millivolts FROM cell_voltage WHERE date_time <= %s ORDER BY date_time ASC", (end,))
            else:
                cur.execute("SELECT date_time, cell_id, millivolts FROM cell_voltage ORDER BY date_time ASC")
    return jsonify(cur.fetchall())

def data_api_db_value(data):
    cur = conn.cursor()
    if data == 'voltage':
        cur.execute("SELECT cell.cell_id, cell_voltage.millivolts, cell.uninstalled_on FROM cell_voltage JOIN \
                     (SELECT cell_id, MAX(date_time) AS date_time FROM cell_voltage GROUP BY cell_id) max \
                     ON cell_voltage.cell_id = max.cell_id AND cell_voltage.date_time = max.date_time \
                     RIGHT JOIN cell ON cell_voltage.cell_id = cell.cell_id ORDER BY cell.cell_id ASC;")
    return jsonify(cur.fetchall())

@app.route('/data-api/historic/<data>', methods = ['GET'])
def data_api_historic(data):
    allowed_data = ("voltage",)
    if data not in allowed_data:
        abort(404)
    try:
        start = datetime.datetime.fromisoformat(request.args['start'])
    except KeyError:
        start = None
    except ValueError:
        abort(400)
    try:
        end = datetime.datetime.fromisoformat(request.args['end'])
    except KeyError:
        end = None
    except ValueError:
        abort(400)
    return data_api_db_range(data, start, end)

@app.route('/data-api/live/<data>', methods = ['GET'])
def data_api_live(data):
    allowed_data = ("voltage",)
    if data not in allowed_data:
        abort(404)
    end = datetime.datetime.now()
    delta = datetime.timedelta(weeks=request.args.get('weeks', 0, int), days=request.args.get('days', 0, int),
                                hours=request.args.get('hours', 0, int), minutes=request.args.get('minutes', 0, int),
                                seconds=request.args.get('seconds', 0, int))
    start = end - delta
    return data_api_db_range(data, start, end)

@app.route('/data-api/value/<data>', methods = ['GET'])
def data_api_value(data):
    allowed_data = ("voltage",)
    if data not in allowed_data:
        abort(404)
    return data_api_db_value(data)
    