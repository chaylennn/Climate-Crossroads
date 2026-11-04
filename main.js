const colors = {
  historical: "#555", ssp126: "#1a9850", ssp245: "#fdae61",
  ssp370: "#f46d43", ssp585: "#a50026"
};

const margin = { top: 20, right: 90, bottom: 40, left: 55 };
const width = 850 - margin.left - margin.right;
const height = 450 - margin.top - margin.bottom;

const svg = d3.select("#chart").append("svg")
  .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
  .append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const x = d3.scaleLinear().range([0, width]);
const y = d3.scaleLinear().range([height, 0]);
const xAxis = svg.append("g").attr("transform", `translate(0,${height})`);
const yAxis = svg.append("g");

svg.append("text")
  .attr("x", -height / 2).attr("y", -40)
  .attr("transform", "rotate(-90)").attr("text-anchor", "middle")
  .attr("font-size", 13)
  .text("Warming vs 1850-1900 (°C)");

d3.csv("data/climate_paths.csv", d3.autoType).then(raw => {
  // only keep years up to 2100 (most models stop there)
  const data = raw.filter(d => d.year <= 2100);

  x.domain(d3.extent(data, d => d.year));
  xAxis.call(d3.axisBottom(x).tickFormat(d3.format("d")));

  // crossroads marker at 2015
  svg.append("line")
    .attr("x1", x(2015)).attr("x2", x(2015))
    .attr("y1", 0).attr("y2", height)
    .attr("stroke", "#999").attr("stroke-dasharray", "4 4");
  svg.append("text")
    .attr("x", x(2015) + 5).attr("y", 12)
    .attr("font-size", 12).attr("fill", "#666")
    .text("Paths split");

  // region dropdown
  const regions = [...new Set(data.map(d => d.region))].sort();
  const select = d3.select("#region-select");
  select.selectAll("option").data(regions).join("option").text(d => d);
  select.on("change", e => update(e.target.value));

  const area = d3.area().x(d => x(d.year)).y0(d => y(d.low)).y1(d => y(d.high));
  const line = d3.line().x(d => x(d.year)).y(d => y(d.median));

  function update(region) {
    const sub = data.filter(d => d.region === region);
    const byScenario = Array.from(d3.group(sub, d => d.scenario));

    y.domain([d3.min(sub, d => d.low), d3.max(sub, d => d.high)]).nice();
    yAxis.transition().duration(500).call(d3.axisLeft(y));

    svg.selectAll(".band").data(byScenario, d => d[0])
      .join("path").attr("class", "band")
      .attr("fill", d => colors[d[0]]).attr("opacity", 0.15)
      .transition().duration(500).attr("d", d => area(d[1]));

    svg.selectAll(".path").data(byScenario, d => d[0])
      .join("path").attr("class", "path")
      .attr("fill", "none").attr("stroke", d => colors[d[0]]).attr("stroke-width", 2)
      .transition().duration(500).attr("d", d => line(d[1]));

    svg.selectAll(".label").data(byScenario, d => d[0])
      .join("text").attr("class", "label")
      .attr("x", width + 5).attr("font-size", 12)
      .attr("fill", d => colors[d[0]]).text(d => d[0])
      .transition().duration(500)
      .attr("y", d => y(d[1][d[1].length - 1].median));
  }

  update(regions[0]);
});