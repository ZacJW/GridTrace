var ctx = document.getElementById('chart-1').getContext('2d');
var chart_config = {type: 'line',
                    data: {
                        datasets: []
                    },
                    options: {
                        legend: {
                            display: false
                        },
                        maintainAspectRatio: false,
                        responsive: true,
                        tooltips: {
                            // mode: 'x',
                            intersect: false,
                            position: 'nearest',
                            callbacks: {
                                label: function (tooltipitem, data){
                                    return  data.datasets[tooltipitem.datasetIndex].label + ": " + tooltipitem.value + 'V';
                                }
                            }
                        },
                        scales: {
                            xAxes: [{
                                type: "time",
                                bounds: "auto",
                                display: true,
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

var time_range = luxon.Duration.fromISO("PT5M");

var load_interval = setInterval(load_chart, 2000);
var isLoaded = false;

function load_chart(){
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
        if (!isLoaded && this.readyState == 4 && this.status == 200){
            var response = JSON.parse(this.responseText);
            if (response.length == 0){
                return;
            }
            var bd = build_datasets(response);
            var datasets = bd[0];
            chart_cell_voltage.data.cells = bd[1];
            var last_moment = luxon.DateTime.fromHTTP(response[response.length-1][0]);
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
    xhr.open("GET", "/data-api/live/voltage?hours=48");
    xhr.send();
}

function build_datasets(response){
    var datasets = [];
    var cell_id_map = {};
    for (data_point of response){
        var time = luxon.DateTime.fromHTTP(data_point[0]);
        var cell_id = data_point[1];
        var volts = data_point[2] / 1000;
        if (!(cell_id in cell_id_map)){
            cell_id_map[cell_id] = datasets.length;
            datasets.push({label: 'Cell ' + cell_id, cell_id: cell_id, data: [], cublicInterpolationMode: 'monotone'});
        }
        datasets[cell_id_map[cell_id]].data.push({x: time, y: volts});
    }
    return [datasets, cell_id_map];
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
            var bd = build_datasets(response);
            var datasets = bd[0];
            var cells = bd[1];
            var last_moment = luxon.DateTime.fromHTTP(response[response.length-1][0])
            if (this.last_moment != chart_cell_voltage.data.last_moment){
                return;
            }
            chart_cell_voltage.data.cells = Object.assign(chart_cell_voltage.data.cells, cells);
            for (new_dataset of datasets){
                var merged = false;
                for (var i = 0; i < chart_cell_voltage.data.datasets.length; i++){
                    if (new_dataset.cell_id == chart_cell_voltage.data.datasets[i].cell_id){
                        chart_cell_voltage.data.datasets[i].data = chart_cell_voltage.data.datasets[i].data.concat(new_dataset.data.slice(1))
                        merged = true;
                        break;
                    }
                }
                if (!merged){
                    chart_cell_voltage.data.datasets.push(new_dataset);
                }
            }

            var cutoff = last_moment.minus(time_range);
            for (dataset of chart_cell_voltage.data.datasets){
                var remove = 0;
                for (; remove < dataset.data.length; remove++){
                    if (dataset.data[remove].x >= cutoff){
                        break;
                    }
                }
                dataset.data.splice(0, remove)
            }


            datasets.sort(compare_datasets);
            colour_datasets(chart_cell_voltage.data.datasets);
            chart_cell_voltage.data.last_moment = last_moment;
            chart_cell_voltage.update(0);
        }
    }
    
    xhr.open("GET", "/data-api/historic/voltage?start=" + encodeURIComponent(chart_cell_voltage.data.last_moment.toISO()));
    xhr.last_moment = chart_cell_voltage.data.last_moment;
    xhr.send();
}


var legend = document.getElementById('cell-voltage-legend');

function series_toggle(icon_elem, cell_id){
    for (var i=0; i<chart_cell_voltage.data.datasets.length; i++){
        if (chart_cell_voltage.data.datasets[i].cell_id == cell_id){
            var meta = chart_cell_voltage.getDatasetMeta(i);
            meta.hidden = !Boolean(meta.hidden);
            if (meta.hidden){
                icon_elem.src = "/icons/feather/eye-off.svg";
            }else{
                icon_elem.src = "/icons/feather/eye.svg";
            }
            chart_cell_voltage.update(0)
            return;
        }
    }
}

var load_legend_interval = setInterval(load_legend, 2000);
var legendIsLoaded = false;

var legend_cells = {}

function load_legend(){
    var legend_xhr = new XMLHttpRequest();
    legend_xhr.onreadystatechange = function(){
        if (this.readyState == 4 && this.status == 200){
            if (legendIsLoaded) return;
            var response = JSON.parse(this.responseText);
            for (cell of response){
                if (cell[2] != null) continue; // Skip cells that have an uninstalled on date, and are as such uninstalled
                let cell_id = cell[0];
                let voltage = Math.round(cell[1] / 10) /100;
                let cell_elem = document.createElement("div");
                cell_elem.className = "cell";
                cell_elem.id = "cell-voltage-" + cell_id;
                let cell_level_elem = document.createElement("div");
                cell_level_elem.className = "cell-level";
                cell_level_elem.style.width = ((voltage - 3.2) * 100) + "%";
                cell_level_elem.style.backgroundColor = "hsl(" + ((voltage - 3.2) * 120) + ", 100%, 85%)";
                let cell_voltage_elem = document.createElement("p");
                cell_voltage_elem.innerHTML= "Cell " + cell_id + ": " + voltage + "V";
                let cell_icon_elem = document.createElement("img");
                cell_icon_elem.src = "/icons/feather/eye.svg";
                cell_icon_elem.addEventListener("click", function(){series_toggle(cell_icon_elem, cell_id)})
                let cell_bump_elem = document.createElement("div");
                cell_bump_elem.className = "bump";
                cell_elem.appendChild(cell_level_elem);
                cell_elem.appendChild(cell_voltage_elem);
                cell_elem.appendChild(cell_icon_elem);
                cell_elem.appendChild(cell_bump_elem);
                legend.appendChild(cell_elem);
                legend_cells[cell_id] = cell_elem;
            }
            clearInterval(load_legend_interval);
            setInterval(update_legend, 10000);
        }
    }
    legend_xhr.open("GET", "/data-api/value/voltage");
    legend_xhr.send();
}


function update_legend(){
    update_xhr = new XMLHttpRequest();
    update_xhr.onreadystatechange = function(){
        if (this.readyState == 4 && this.status == 200){
            var response = JSON.parse(this.responseText);
            for (cell of response){
                let cell_id = cell[0];
                let voltage = Math.round(cell[1] / 10) /100;
                if (cell[2] != null && !(cell_id in chart_cell_voltage.data.cells)) continue;
                if (cell_id in legend_cells){
                    legend_cells[cell_id].children[0].style.width = ((voltage - 3.2) * 100) + "%";
                    legend_cells[cell_id].children[0].style.backgroundColor = "hsl(" + ((voltage - 3.2) * 120) + ", 100%, 85%)";
                    legend_cells[cell_id].children[1].innerHTML = "Cell " + cell_id + ": " + voltage + "V";
                }else{
                    let cell_elem = document.createElement("div");
                    cell_elem.className = "cell";
                    cell_elem.id = "cell-voltage-" + cell_id;
                    if (cell[2] != null) cell_elem.style['border-color'] = 'darkred';
                    let cell_level_elem = document.createElement("div");
                    cell_level_elem.className = "cell-level";
                    cell_level_elem.style.width = ((voltage - 3.2) * 100) + "%";
                    cell_level_elem.style.backgroundColor = "hsl(" + ((voltage - 3.2) * 120) + ", 100%, 85%)";
                    let cell_voltage_elem = document.createElement("p");
                    cell_voltage_elem.innerHTML= "Cell " + cell_id + ": " + voltage + "V";
                    let cell_icon_elem = document.createElement("img");
                    cell_icon_elem.src = "/icons/feather/eye.svg";
                    cell_icon_elem.addEventListener("click", function(){series_toggle(cell_icon_elem, cell_id)});
                    let cell_bump_elem = document.createElement("div");
                    cell_bump_elem.className = "bump";
                    cell_elem.appendChild(cell_level_elem);
                    cell_elem.appendChild(cell_voltage_elem);
                    cell_elem.appendChild(cell_icon_elem);
                    cell_elem.appendChild(cell_bump_elem);
                    legend.appendChild(cell_elem);
                    legend_cells[cell_id] = cell_elem;
                }
            }
        }
    }
    update_xhr.open("GET", "/data-api/value/voltage");
    update_xhr.send();
}