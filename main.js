const colors = {
  historical: "#555", ssp126: "#1a9850", ssp245: "#fdae61",
  ssp370: "#f46d43", ssp585: "#a50026"
};
const names = {
  historical: "Historical",
  ssp126: "SSP1-2.6 (low emissions)",
  ssp245: "SSP2-4.5 (middle)",
  ssp370: "SSP3-7.0 (high)",
  ssp585: "SSP5-8.5 (very high)"
};
const active = new Set(Object.keys(colors));   // scenarios currently shown
const fmt = d3.format("+.1f");

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
const plot = svg.append("g");   // bands, lines, labels go here

svg.append("text")
  .attr("x", -height / 2).attr("y", -40)
  .attr("transform", "rotate(-90)").attr("text-anchor", "middle")
  .attr("font-size", 13)
  .text("Warming vs 1850-1900 (°C)");

const tooltip = d3.select("#tooltip");
let currentSub = [];

d3.csv("data/climate_paths.csv", d3.autoType).then(raw => {
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

  // scenario toggle buttons
  d3.select("#scenario-toggles").selectAll("button")
    .data(Object.keys(colors).filter(k => k !== "historical"))
    .join("button")
    .attr("class", "toggle on")
    .style("--c", d => colors[d])
    .text(d => names[d])
    .on("click", (e, d) => {
      if (active.has(d)) active.delete(d); else active.add(d);
      d3.select(e.currentTarget).classed("on", active.has(d));
      update(select.property("value"));
    });

  const area = d3.area().x(d => x(d.year)).y0(d => y(d.low)).y1(d => y(d.high));
  const line = d3.line().x(d => x(d.year)).y(d => y(d.median));

  function update(region) {
    currentSub = data.filter(d => d.region === region && active.has(d.scenario));
    const byScenario = Array.from(d3.group(currentSub, d => d.scenario));

    y.domain([d3.min(currentSub, d => d.low), d3.max(currentSub, d => d.high)]).nice();
    yAxis.transition().duration(500).call(d3.axisLeft(y));

    plot.selectAll(".band").data(byScenario, d => d[0])
      .join("path").attr("class", "band")
      .attr("fill", d => colors[d[0]]).attr("opacity", 0.15)
      .transition().duration(500).attr("d", d => area(d[1]));

    plot.selectAll(".path").data(byScenario, d => d[0])
      .join("path").attr("class", "path")
      .attr("fill", "none").attr("stroke", d => colors[d[0]]).attr("stroke-width", 2)
      .transition().duration(500).attr("d", d => line(d[1]));

    plot.selectAll(".label").data(byScenario, d => d[0])
      .join("text").attr("class", "label")
      .attr("font-size", 12)
      .attr("fill", d => colors[d[0]]).text(d => d[0])
      .transition().duration(500)
      .attr("x", d => x(d[1][d[1].length - 1].year) + 5)
      .attr("y", d => y(d[1][d[1].length - 1].median));
  }

  // hover: vertical line + tooltip with values for that year
  const hoverLine = svg.append("line")
    .attr("y1", 0).attr("y2", height)
    .attr("stroke", "#333").attr("stroke-width", 1)
    .style("pointer-events", "none")
    .style("display", "none");

  svg.append("rect")
    .attr("width", width).attr("height", height)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .on("mousemove", e => {
      const [mx] = d3.pointer(e);
      const year = Math.round(x.invert(mx));
      const rows = currentSub.filter(d => d.year === year);
      if (!rows.length) return;

      hoverLine.style("display", null).attr("x1", x(year)).attr("x2", x(year));
      tooltip.style("display", "block")
        // flip to the left of the cursor near the right edge
        .style("left", (e.clientX > window.innerWidth - 370 ? e.pageX - 370 : e.pageX + 15) + "px")
        .style("top", (e.pageY - 20) + "px")
        .html(`<strong>${year}</strong><br>` + rows
          .sort((a, b) => b.median - a.median)
          .map(d => `<span class="dot" style="background:${colors[d.scenario]}"></span>` +
                    `${names[d.scenario]}: ${fmt(d.median)}°C ` +
                    `<span style="color:#888">(${fmt(d.low)} to ${fmt(d.high)})</span>`)
          .join("<br>"));
    })
    .on("mouseleave", () => {
      hoverLine.style("display", "none");
      tooltip.style("display", "none");
    });

  update(regions[0]);
});
