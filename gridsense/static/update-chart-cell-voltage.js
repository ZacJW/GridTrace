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
                                display: true
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
var chart_cell_voltage = new Chart(ctx, chart_config)
var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function(){
    if (this.readyState == 4 && this.status == 200){
        var response = JSON.parse(this.responseText);
        var datasets = {};
        for (data of response){
            for (reading of data[1]){
                if (!(reading[0] in datasets)){
                    datasets[reading[0]] = {data: []};
                }
                datasets[reading[0]].data.push({x: moment(data[0]), y: reading[1]/1000})
            }
        }
        for (set in datasets){
            datasets[set].label = 'Cell ' + set;
        }
        datasets = Object.values(datasets);
        for (set in datasets){
            datasets[set].borderColor = 'hsl(' + parseInt(set / datasets.length * 360) + ', 65%, 65%)';
            datasets[set].backgroundColor = 'hsl(' + parseInt(set / datasets.length * 360) + ', 65%, 65%)';
            datasets[set].fill = false;
            chart_config.data.datasets.push(datasets[set])
        }
        chart_cell_voltage.update()
        
    }
};
//var start = moment().subtract(1, 'day');
//var end = moment();
//xhttp.open("GET", "/chart-api/historic/voltage?start=" + encodeURIComponent(start.format())
//                 + "&end=" + encodeURIComponent(end.format()));
xhttp.open("GET", "/chart-api/live/voltage?hours=24");
xhttp.send();