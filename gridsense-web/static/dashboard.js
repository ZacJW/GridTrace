function build_datasets(response){
    var datasets = [];
    var cell_id_map = {};
    for (data_point of response){
        var time = luxon.DateTime.fromHTTP(data_point[0]);
        var cell_id = data_point[1];
        var volts = data_point[2] / 1000;
        if (!(cell_id in cell_id_map)){
            cell_id_map[cell_id] = datasets.length;
            datasets.push({label: 'Cell ' + cell_id, cell_id: cell_id, data: [], cubicInterpolationMode: 'monotone'});
        }
        datasets[cell_id_map[cell_id]].data.push({x: time, y: volts});
    }
    return [datasets, cell_id_map];
}

function compare_cell_datasets(a, b){
    return a.cell_id - b.cell_id;
}

function colour_datasets(datasets){
    for (set in datasets){
        datasets[set].borderColor = 'hsl(' + parseInt(set / datasets.length * 360) + ', 65%, 65%)';
        datasets[set].backgroundColor = 'hsl(' + parseInt(set / datasets.length * 360) + ', 65%, 65%)';
        datasets[set].fill = false;
    }
}

class Tile{
    constructor(container, name){
        this.tile_elem = document.createElement("section");
        this.tile_elem.className = "tile";

        this.top_bar_elem = document.createElement("div");
        this.top_bar_elem.className = "tile-top";

        this.header_elem = document.createElement("header");
        this.header_elem.innerHTML = name

        this.top_bar_elem.appendChild(this.header_elem);
        this.tile_elem.appendChild(this.top_bar_elem);
        container.appendChild(this.tile_elem);
    }
}

var cell_voltage_chart_config = {
    type: 'line',
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
};

var power_energy_chart_config = {
    type: 'line',
    data: {
        datasets: []
    },
    options: {
        maintainAspectRatio: false,
        responsive: true,
        tooltips: {
            mode: 'x',
            intersect: false,
            callbacks: {

            }
        },
        scales: {
            xAxes: [{
                type: "time",
                bounds: "auto",
                display: true
            }],
            yAxes: [{
                display: true,
                ticks: {

                }
            }]
        }
    }
};

class Cell_Voltage_Tile extends Tile{
    constructor(container){
        super(container, "Cell Voltage");

        this.legend_elem = document.createElement("div");
        this.legend_elem.className = "legend";
        this._initialise_legend();
        this.tile_elem.appendChild(this.legend_elem);

        this.chart_elem = document.createElement("div");
        this.chart_elem.className = "chart";

        this.chart_canvas_elem = document.createElement("canvas");
        this.chart_elem.appendChild(this.chart_canvas_elem);

        this.tile_elem.appendChild(this.chart_elem);

        this.chart = new Chart(this.chart_canvas_elem.getContext("2d"), cell_voltage_chart_config);
        this.chart.data.cell_id_index_map = {};
        this.chart_controls_elem = document.createElement("div");
        this.chart_controls_elem.className = "chart-controls";
        this._initialise_controls();
        this.tile_elem.appendChild(this.chart_controls_elem);
        this.time_range = luxon.Duration.fromISO("P1D");
        this.load_chart_interval = setInterval(this.load_chart_request.bind(this), 2000);

        this.legend_cells = {};
        setTimeout(this.update_legend_request.bind(this), 2500);
        this.update_legend_interval = setInterval(this.update_legend_request.bind(this), 10000);
    }

    _initialise_legend(){
        var show_all_elem = document.createElement("div");
        show_all_elem.className = "legend-button";
        show_all_elem.addEventListener("click", this.show_all.bind(this));

        var show_all_text_elem = document.createElement("p");
        show_all_text_elem.innerHTML = "Show All";
        show_all_elem.appendChild(show_all_text_elem);

        var show_all_icon_elem = document.createElement("img");
        show_all_icon_elem.src = "/icons/feather/eye.svg";
        show_all_elem.appendChild(show_all_icon_elem);

        var hide_all_elem = document.createElement("div");
        hide_all_elem.className = "legend-button";
        hide_all_elem.addEventListener("click", this.hide_all.bind(this));

        var hide_all_text_elem = document.createElement("p");
        hide_all_text_elem.innerHTML = "Hide All";
        hide_all_elem.appendChild(hide_all_text_elem);

        var hide_all_icon_elem = document.createElement("img");
        hide_all_icon_elem.src = "/icons/feather/eye-off.svg";
        hide_all_elem.appendChild(hide_all_icon_elem);

        this.legend_elem.appendChild(show_all_elem);
        this.legend_elem.appendChild(hide_all_elem);
    }

    show_all(){
        for (var cell_id in this.legend_cells){
            if (cell_id in this.chart.data.cell_id_index_map){
                this.legend_cells[cell_id].children[2].src = "/icons/feather/eye.svg";
                var meta = this.chart.getDatasetMeta(this.chart.data.cell_id_index_map[cell_id]);
                meta.hidden = false;
            }
        }
        this.chart.update();
    }

    hide_all(){
        for (var cell_id in this.legend_cells){
            if (cell_id in this.chart.data.cell_id_index_map){
                this.legend_cells[cell_id].children[2].src = "/icons/feather/eye-off.svg";
                var meta = this.chart.getDatasetMeta(this.chart.data.cell_id_index_map[cell_id]);
                meta.hidden = true;
            }
        }
        this.chart.update();
    }

    _initialise_controls(){
        this.chart_controls_form_elem = document.createElement("form");
        this.chart_controls_form_elem.addEventListener("submit", this._mode_update.bind(this))
        // Mode agnostic elems
        // Create update button
        var chart_update_button_elem = document.createElement("button");
        chart_update_button_elem.innerHTML = "Update";
        this.chart_controls_form_elem.appendChild(chart_update_button_elem);
        
        // Create mode label
        var chart_mode_label_elem = document.createElement("label");
        chart_mode_label_elem.innerHTML = "Chart Mode";
        this.chart_controls_form_elem.appendChild(chart_mode_label_elem);

        // Create mode select
        var chart_mode_select_elem = document.createElement("select");
        chart_mode_select_elem.addEventListener("change", this._change_mode.bind(this, chart_mode_select_elem))
        var chart_mode_option_live_elem = document.createElement("option");
        chart_mode_option_live_elem.value = "live";
        chart_mode_option_live_elem.innerHTML = "Live";
        var chart_mode_option_fixed_elem = document.createElement("option");
        chart_mode_option_fixed_elem.value = "fixed";
        chart_mode_option_fixed_elem.innerHTML = "Fixed";
        chart_mode_select_elem.appendChild(chart_mode_option_live_elem);
        chart_mode_select_elem.appendChild(chart_mode_option_fixed_elem);
        this.chart_controls_form_elem.appendChild(chart_mode_select_elem);

        this.chart_mode = chart_mode_select_elem.value;
        this.mode_specific_elems = [];
        
        // Initialise mode specific elems
        this._change_mode(chart_mode_select_elem);

        this.chart_controls_elem.appendChild(this.chart_controls_form_elem);
    }

    _create_control_label_elem(name, text, form_elem){
        var elem = document.createElement("label");
        elem.innerHTML = text;
        elem.name = name;
        this.chart_controls_form_elem.appendChild(elem);
        this.mode_specific_elems.push(elem);
    }

    _create_control_input_elem(type){
        var elem = document.createElement("input");
        elem.type = type;
        if (type == "date" || type == "time"){
            elem.className = "date-time";
        }
        this.chart_controls_form_elem.appendChild(elem);
        this.mode_specific_elems.push(elem);
    }

    _change_mode(select_elem){
        if (select_elem.value == "live"){
            this._change_mode_live();
        }else if (select_elem.value == "fixed"){
            this._change_mode_fixed();
        }
        this.chart_mode = select_elem.value;
    }

    _change_mode_live(){
        this._remove_mode_specific_items();
        this._create_control_label_elem("days", "Days: ");
        this._create_control_input_elem("number");
        this._create_control_label_elem("hours", "Hours: ");
        this._create_control_input_elem("number");
        this._create_control_label_elem("minutes", "Minutes: ");
        this._create_control_input_elem("number");
        this._create_control_label_elem("seconds", "Seconds: ");
        this._create_control_input_elem("number");
    }

    _change_mode_fixed(){
        this._remove_mode_specific_items();
        this._create_control_label_elem("start_date", "Start Date: ");
        this._create_control_input_elem("date");
        this._create_control_label_elem("start_time", "Start Time: ");
        this._create_control_input_elem("time");
        this._create_control_label_elem("end_date", "End Date: ");
        this._create_control_input_elem("date");
        this._create_control_label_elem("end_time", "End Time: ");
        this._create_control_input_elem("time");
    }
    _remove_mode_specific_items(){
        for (var elem of this.mode_specific_elems){
            elem.remove();
        }
        this.mode_specific_elems = [];
    }

    _mode_update(event){
        event.preventDefault();
        if (this.chart_mode == "live"){
            var days = Number(this.mode_specific_elems[1].value);
            var hours = Number(this.mode_specific_elems[3].value);
            var minutes = Number(this.mode_specific_elems[5].value);
            var seconds = Number(this.mode_specific_elems[7].value);

            if (this.load_chart_interval){
                clearInterval(this.load_chart_interval);
                delete this.load_chart_interval;
            }
            if (this.load_chart_xhr){
                this.load_chart_xhr.abort();
            }
            if (this.update_chart_interval){
                clearInterval(this.update_chart_interval);
                delete this.update_chart_interval;
            }
            if (this.update_chart_xhr){
                this.update_chart_xhr.abort();
            }
            this.chart.data.datasets = [];
            this.chart.update();
            this.time_range = luxon.Duration.fromObject({days: days, hours: hours, minutes: minutes, seconds: seconds})

            this.load_chart_interval = setInterval(this.load_chart_request.bind(this), 2000);

        }else if (this.chart_mode == "fixed"){
            var start_date = this.mode_specific_elems[1].value;
            var start_time = this.mode_specific_elems[3].value;
            var end_date = this.mode_specific_elems[5].value;
            var end_time = this.mode_specific_elems[7].value;

            var start_datetime = this._create_datetime(start_date, start_time);
            var end_datetime = this._create_datetime(end_date, end_time);

            console.log(start_datetime);
            console.log(end_datetime);

            // Clear and abort all chart requests

            if (this.load_chart_interval){
                clearInterval(this.load_chart_interval);
                delete this.load_chart_interval;
            }
            if (this.load_chart_xhr){
                this.load_chart_xhr.abort();
            }
            if (this.update_chart_interval){
                clearInterval(this.update_chart_interval);
                delete this.update_chart_interval;
            }
            if (this.update_chart_xhr){
                this.update_chart_xhr.abort();
            }
            
            this.fixed_chart_request(start_datetime, end_datetime);
        }
        // for (var elem of this.mode_specific_elems){
        //     if (elem.tagName == "INPUT"){
        //         console.log(elem);
        //     }
        // }
    }

    fixed_chart_request(start, end){
        this.load_chart_xhr = new XMLHttpRequest();
        var xhr = this.load_chart_xhr;
        this.load_chart_xhr.onreadystatechange = this.fixed_chart_response.bind(this, xhr);
        var and = "";
        if (start == null){
            start = "";
        }else{
            start = "start=" + encodeURIComponent(start.toISO());
        }
        if (end == null){
            end = "";
        }else{
            end = "end=" + encodeURIComponent(end.toISO());
        }
        if (start != "" && end != ""){
            and = "&";
        }
        this.load_chart_xhr.open("GET", "/data-api/historic/voltage?" + start + and + end);
        this.load_chart_xhr.send();
    }

    fixed_chart_response(xhr){
        // If response is good
        if (xhr.readyState == 4 && xhr.status == 200){
            var response = JSON.parse(xhr.responseText);
            var bd = build_datasets(response);
            this.chart.data.datasets = bd[0];
            this.chart.data.cell_id_index_map = bd[1];
            this.chart.data.datasets.sort(compare_cell_datasets);
            colour_datasets(this.chart.data.datasets);
            this.chart.update();
        }
    }

    _create_datetime(date, time){
        var datetime = null;
        if (date != "" & time != ""){
            datetime = luxon.DateTime.fromISO(date + "T" + time);
        }else if (date!= "" && time == ""){
            datetime = luxon.DateTime.fromISO(date);
        }else if (date == "" && time != ""){
            datetime = luxon.DateTime.local();
            time = time.split(":");
            datetime = datetime.set({hour: time[0], minute: time[1], second: 0, millisecond: 0});
        }
        return datetime;
    }

    update_cell_id_index_map(){
        this.cell_id_index_map = {}
        for (var i = 0; i < this.chart.data.datasets.length; i++){
            this.cell_id_index_map[this.chart.data.datasets[i].cell_id] = i;
        }
    }

    load_chart_request(){
        // Abort any previously made load requests
        if (this.load_chart_xhr){this.load_chart_xhr.abort()}
        this.load_chart_xhr = new XMLHttpRequest();
        var xhr = this.load_chart_xhr
        this.load_chart_xhr.onreadystatechange = this.load_chart_response.bind(this, xhr);
        var args = ""
        for (var arg in this.time_range.values){
            if (this.time_range.values[arg] == 0){continue}
            if (args != ""){
                args += "&";
            }
            args += arg + "=" + this.time_range.values[arg];
        }
        this.load_chart_xhr.open("GET", "/data-api/live/voltage?" + args);
        this.load_chart_xhr.send();
    }

    load_chart_response(xhr){
        // If response is good
        if (xhr.readyState == 4 && xhr.status == 200){
            var response = JSON.parse(xhr.responseText);
            if (response.length == 0){
                return;
            }
            var bd = build_datasets(response);
            var datasets = bd[0];
            this.chart.data.cell_id_index_map = bd[1];
            // Keep track of time of newest datapoint
            this.updated_time = luxon.DateTime.fromHTTP(response[response.length-1][0]);
            datasets.sort(compare_cell_datasets);
            colour_datasets(datasets);
            this.chart.data.datasets = datasets;
            this.chart.update();
            clearInterval(this.load_chart_interval);
            delete this.load_chart_interval;
            this.update_chart_interval = setInterval(this.update_chart_request.bind(this), 10000);
            this.load_chart_xhr.abort();
        }
    }

    update_chart_request(){
        this.update_chart_xhr = new XMLHttpRequest();
        var updated_time_at_request = this.updated_time;
        var xhr = this.update_chart_xhr;
        this.update_chart_xhr.onreadystatechange = this.update_chart_response.bind(this, xhr, updated_time_at_request);
        this.update_chart_xhr.open("GET", "/data-api/historic/voltage?start=" + encodeURIComponent(this.updated_time.toISO()));
        this.update_chart_xhr.send();
    }

    update_chart_response(xhr, updated_time_at_request){
        // If response is good
        if (xhr.readyState == 4 && xhr.status == 200){
            // If updated time when request was made doesn't match what it is now,
            // return now since a newer request must have already been handled
            if (updated_time_at_request != this.updated_time){
                return;
            }
            var response = JSON.parse(xhr.responseText);
            var bd = build_datasets(response);
            var new_datasets = bd[0];

            var new_updated_time = luxon.DateTime.fromHTTP(response[response.length-1][0])
            // Merge chart datasets with new ones
            for (var new_dataset of new_datasets){
                var merged = false;
                for (var i = 0; i < this.chart.data.datasets.length; i++){
                    if (new_dataset.cell_id == this.chart.data.datasets[i].cell_id){
                        // If the last datapoint of the existing dataset matches the first of the new dataset, skip that first point
                        if(this.chart.data.datasets[i].data[this.chart.data.datasets[i].data.length - 1].x == new_dataset.data[0]){
                            this.chart.data.datasets[i].data = this.chart.data.datasets[i].data.concat(new_dataset.data.slice(1))
                        // Otherwise, include the first point of the new dataset
                        }else{
                            this.chart.data.datasets[i].data = this.chart.data.datasets[i].data.concat(new_dataset.data)
                        }
                        merged = true;
                        break;
                    }
                }
                if (!merged){
                    this.chart.data.datasets.push(new_dataset);
                }
            }
            // Remove datapoints that are now too old
            var cutoff = new_updated_time.minus(this.time_range);
            for (var dataset of this.chart.data.datasets){
                var remove = 0;
                for (; remove < dataset.data.length; remove++){
                    if (dataset.data[remove].x >= cutoff){
                        break;
                    }
                }
                dataset.data.splice(0, remove)
            }

            // Remove empty datasets
            for (var i = this.chart.data.datasets.length - 1; i >= 0; i--){
                if(this.chart.data.datasets[i].data.length == 0){
                    this.chart.data.datasets.splice(i, 1);
                }
            }

            this.chart.data.datasets.sort(compare_cell_datasets);
            colour_datasets(this.chart.data.datasets);
            this.update_cell_id_index_map();
            this.updated_time = new_updated_time;
            this.chart.update(0);
        }
    }

    update_legend_request(){
        this.legend_xhr = new XMLHttpRequest();
        var xhr = this.legend_xhr;
        this.legend_xhr.onreadystatechange = this.update_legend_response.bind(this, xhr);
        this.legend_xhr.open("GET", "/data-api/value/voltage");
        this.legend_xhr.send();
    }

    update_legend_response(xhr){
        // If response is good
        if (xhr.readyState == 4 && xhr.status == 200){
            var response = JSON.parse(xhr.responseText);
            for (var cell of response){
                let cell_id = cell[0];
                let voltage = Math.round(cell[1] / 10) /100;
                // If cell is uninstalled and not in the chart, don't add it to the legend
                if (cell[2] != null && !(cell_id in this,chart.data.cells)) continue;
                if (cell_id in this.legend_cells){
                    this.legend_cells[cell_id].children[0].style.width = ((voltage - 3.2) * 100) + "%";
                    this.legend_cells[cell_id].children[0].style.backgroundColor = "hsl(" + ((voltage - 3.2) * 120) + ", 100%, 85%)";
                    this.legend_cells[cell_id].children[1].innerHTML = "Cell " + cell_id + ": " + voltage + "V";
                }else{
                    let cell_elem = document.createElement("div");
                    cell_elem.className = "cell";
                    // cell_elem.id = "cell-voltage-" + cell_id;
                    if (cell[2] != null) {cell_elem.style['border-color'] = 'darkred'}
                    let cell_level_elem = document.createElement("div");
                    cell_level_elem.className = "cell-level";
                    cell_level_elem.style.width = ((voltage - 3.2) * 100) + "%";
                    cell_level_elem.style.backgroundColor = "hsl(" + ((voltage - 3.2) * 120) + ", 100%, 85%)";
                    let cell_text_elem = document.createElement("p");
                    cell_text_elem.innerHTML= "Cell " + cell_id + ": " + voltage + "V";
                    let cell_icon_elem = document.createElement("img");
                    cell_icon_elem.src = "/icons/feather/eye.svg";
                    cell_icon_elem.addEventListener("click", this.chart_dataset_toggle.bind(this, cell_icon_elem, cell_id));
                    let cell_bump_elem = document.createElement("div");
                    cell_bump_elem.className = "bump";
                    cell_elem.appendChild(cell_level_elem);
                    cell_elem.appendChild(cell_text_elem);
                    cell_elem.appendChild(cell_icon_elem);
                    cell_elem.appendChild(cell_bump_elem);
                    this.legend_elem.appendChild(cell_elem);
                    this.legend_cells[cell_id] = cell_elem;
                }
            }
        }
    }

    chart_dataset_toggle(cell_icon_elem, cell_id){
        for (var i=0; i<this.chart.data.datasets.length; i++){
            if (this.chart.data.datasets[i].cell_id == cell_id){
                var meta = this.chart.getDatasetMeta(i);
                meta.hidden = !Boolean(meta.hidden);
                if (meta.hidden){
                    cell_icon_elem.src = "/icons/feather/eye-off.svg";
                }else{
                    cell_icon_elem.src = "/icons/feather/eye.svg";
                }
                this.chart.update(0)
                return;
            }
        }
    }
}

class Power_Energy_Tile extends Tile{
    constructor(container){
        super(container, "Power and Energy");

        this.legend_elem = document.createElement("div");
        this.legend_elem.className = "legend";
        this._initialise_legend();
        this.tile_elem.appendChild(this.legend_elem);

        this.chart_elem = document.createElement("div");
        this.chart_elem.className = "chart";

        this.chart_canvas_elem = document.createElement("canvas");
        this.chart_elem.appendChild(this.chart_canvas_elem);

        this.tile_elem.appendChild(this.chart_elem);

        this.chart = new Chart(this.chart_canvas_elem.getContext("2d"), power_energy_chart_config);
    }
}

var cell_voltage_tile = new Cell_Voltage_Tile(document.getElementById("dc"));
var power_energy_tile = new Power_Energy_Tile(document.getElementById("dc"));