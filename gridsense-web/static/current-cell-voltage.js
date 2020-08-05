var legend = document.getElementById('cell-voltage-legend');
var cells = [
    {cell_id: 0, voltage: 3.5},
    {cell_id: 1, voltage: 4.2},
    {cell_id: 2, voltage: 3.3},
    {cell_id: 3, voltage: 3.7},
    {cell_id: 4, voltage: 3.9},
];

for (cell of cells){
    var cell_elem = document.createElement("div");
    cell_elem.className = "cell";
    var cell_level_elem = document.createElement("div");
    cell_level_elem.className = "cell-level";
    cell_level_elem.style.height = ((cell.voltage - 3.2) * 100) + "%";
    cell_level_elem.style.backgroundColor = "hsl(" + ((cell.voltage - 3.2) * 120) + ", 100%, 85%)";
    var cell_voltage_elem = document.createElement("p");
    cell_voltage_elem.innerHTML= cell.voltage + "V";
    var cell_tooltip_elem = document.createElement("span");
    cell_tooltip_elem.className = "cell-tooltip";
    cell_tooltip_elem.innerHTML = "Cell " + cell.cell_id;
    var cell_tooltip_icon_elem = document.createElement("img");
    cell_tooltip_icon_elem.src = "/icons/feather/eye.svg";
    cell_tooltip_elem.appendChild(cell_tooltip_icon_elem);
    cell_elem.appendChild(cell_level_elem);
    cell_elem.appendChild(cell_voltage_elem);
    cell_elem.appendChild(cell_tooltip_elem);
    legend.appendChild(cell_elem);
}