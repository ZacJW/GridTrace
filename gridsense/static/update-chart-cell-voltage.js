var ctx = document.getElementById('chart-1').getContext('2d');
var chart_config = {type: 'line',
                    data: {
                        datasets: []
                    },
                    options: {
                        maintainAspectRatio: false,
                        responsive: true,
                        scales: {
                            xAxes: [{
                                type: "time",
                                display: true,
                                time: {
                                }
                            }],
                            yAxes: [{
                                display: true,
                                ticks: {
                                    callback: function(value, index, values){
                                        return value + 'V';
                                    }
                                }

                            }]
                        }
                    }
                }
var chart_cell_voltage = new Chart(ctx, chart_config);

var load_interval = setInterval(load_data, 2000);
var isLoaded = false;

function load_data(){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if (!isLoaded && this.readyState == 4 && this.status == 200){
            var response = JSON.parse(this.responseText);
            if (response.length == 0){
                return;
            }
            var datasets = build_datasets(response);
            var last_moment = luxon.DateTime.fromHTTP(response[response.length-1][0])
            datasets.sort(compare_datasets);
            colour_datasets(datasets);
            chart_cell_voltage.data.datasets = datasets;
            chart_cell_voltage.data.last_moment = last_moment;
            chart_cell_voltage.update();
            clearInterval(load_interval);
            isLoaded = true;
            setInterval(live_update, 10000);
        }
    }
    xhr.open("GET", "/chart-api/live/voltage?hours=24");
    xhr.send();
}

function build_datasets(response){
    var datasets = [];
    var cell_id_map = {};
    for (time_point of response){
        var time = luxon.DateTime.fromHTTP(time_point[0]);
        for (cell_reading of time_point[1]){
            var cell_id = cell_reading[0];
            var volts = cell_reading[1]/1000;
            if (!(cell_id in cell_id_map)){
                cell_id_map[cell_id] = datasets.length;
                datasets.push({data: []});
            }
            datasets[cell_id_map[cell_id]].data.push({x: time, y: volts})
        }
    }
    for (cell_id in cell_id_map){
        datasets[cell_id_map[cell_id]].label = 'Cell ' + cell_id;
        datasets[cell_id_map[cell_id]].cell_id = cell_id;
    }
    return datasets;
}

function compare_datasets(a, b){
    return a.cell_id - b.cell_id;
}

function colour_datasets(datasets){
    for (set in datasets){
        datasets[set].borderColor = 'hsl(' + parseInt(set / datasets.length * 360) + ', 65%, 65%)';
        datasets[set].backgroundColor = 'hsl(' + parseInt(set / datasets.length * 360) + ', 65%, 65%)';
        datasets[set].fill = false;
    }
}

function live_update(){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if (this.readyState == 4 && this.status == 200){
            var response = JSON.parse(this.responseText);
            var datasets = build_datasets(response);
            var last_moment = luxon.DateTime.fromHTTP(response[response.length-1][0])
            if (this.last_moment != chart_cell_voltage.data.last_moment){
                return;
            }
            for (new_dataset of datasets){
                merge_dataset(new_dataset);
            }
            colour_datasets(chart_cell_voltage.data.datasets);
            chart_cell_voltage.data.last_moment = last_moment;
            chart_cell_voltage.update();
        }
    }
    
    xhr.open("GET", "/chart-api/historic/voltage?start=" + encodeURIComponent(chart_cell_voltage.data.last_moment.toISO()));
    xhr.last_moment = chart_cell_voltage.data.last_moment;
    xhr.send();
}

function merge_dataset(new_dataset){
    var merged = false;
    for (var i = 0; i < chart_cell_voltage.data.datasets.length; i++){
        if (new_dataset.cell_id == chart_cell_voltage.data.datasets[i].cell_id){
            chart_cell_voltage.data.datasets[i].data = chart_cell_voltage.data.datasets[i].data.concat(new_dataset.data.slice(1))
            merged = true;
        }
    }
    if (!merged){
        chart_cell_voltage.data.datasets.push(new_dataset);
    }
}