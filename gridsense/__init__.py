from flask import Flask, render_template, url_for, request, abort, jsonify, redirect
import psycopg2, psycopg2.extensions, psycopg2.extras, datetime
app = Flask(__name__)

conn = psycopg2.connect("dbname=gridsense user=gridsense")
psycopg2.extras.register_composite('voltage', conn)
#@app.route('/')
#def home():
#    return redirect('/static/index.html')



def chart_api_db(chart, start=None, end=None):
    cur = conn.cursor()
    if chart == 'voltage':
        if start is not None:
            if end is not None:
                cur.execute("SELECT date, reading_arr FROM cell_voltage WHERE date BETWEEN %s and %s ORDER BY date DESC", (start, end))
            else:
                cur.execute("SELECT date, reading_arr FROM cell_voltage WHERE date > %s ORDER BY date DESC", (start,))
        else:
            if end is not None:
                cur.execute("SELECT date, reading_arr FROM cell_voltage WHERE date < %s ORDER BY date DESC", (end,))
            else:
                cur.execute("SELECT date, reading_arr FROM cell_voltage ORDER BY date DESC")
    elif chart == 'current':
        cur.execute("Select date, cell_id, milliamps from cell_current order by date desc limit 100")
    return jsonify(cur.fetchall())

@app.route('/chart-api/historic/<chart>', methods = ['GET'])
def chart_api_historic(chart):
    allowed_charts = ("voltage", "current")
    if chart not in allowed_charts:
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
    return chart_api_db(chart, start, end)

@app.route('/chart-api/live/<chart>', methods = ['GET'])
def chart_api_live(chart):
    allowed_charts = ("voltage", "current")
    if chart not in allowed_charts:
        abort(404)
    end = datetime.datetime.utcnow()
    try:
        delta = datetime.timedelta(hours=int(request.args['hours']))
    except KeyError:
        delta = datetime.timedelta(hours=24)
    except ValueError:
        abort(400)
    start = end - delta
    return chart_api_db(chart, start, end)
