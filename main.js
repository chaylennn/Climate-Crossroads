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
// short names for the labels at the end of each line
const shortNames = { ssp126: "Low", ssp245: "Middle", ssp370: "High", ssp585: "Very high" };
const THRESHOLD = 2;   // +2°C reference line
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
const ref = svg.append("g");    // +2°C reference line (drawn under the data)
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

  // late-century (2081-2100) median warming for a region and scenario
  const late = (region, scen) => d3.mean(
    data.filter(d => d.region === region && d.scenario === scen && d.year >= 2081), d => d.median);

  // quick-pick buttons: a familiar region plus the fastest and slowest warming regions
  const lateHigh = regions.map(r => ({ region: r, v: late(r, "ssp585") })).sort((a, b) => b.v - a.v);
  const picks = [
    { label: "W. North America", region: "W.North-America" },
    { label: `Fastest: ${lateHigh[0].region}`, region: lateHigh[0].region },
    { label: `Slowest: ${lateHigh[lateHigh.length - 1].region}`, region: lateHigh[lateHigh.length - 1].region }
  ];
  d3.select("#quick-picks").selectAll("button").data(picks).join("button")
    .attr("class", "pick").text(d => d.label)
    .on("click", (e, d) => { select.property("value", d.region); update(d.region); });

  // first year the median reaches the threshold (historical + one scenario)
  function crossing(region, scen) {
    const series = data.filter(d => d.region === region && (d.scenario === "historical" || d.scenario === scen))
      .sort((a, b) => a.year - b.year);
    const hit = series.find(d => d.median >= THRESHOLD);
    return hit ? hit.year : null;
  }

  // one-paragraph summary under the chart for the selected region
  function takeaway(region) {
    const lo = late(region, "ssp126"), hi = late(region, "ssp585");
    const cLo = crossing(region, "ssp126"), cHi = crossing(region, "ssp585");
    const loR = +lo.toFixed(1), hiR = +hi.toFixed(1);
    let cross;
    if (cLo != null && cLo < 2015) {
      cross = `It had already passed +2°C by ${cLo}, before the paths split.`;
    } else {
      const when = c => c == null ? "never passes +2°C by 2100" : `passes +2°C around ${c}`;
      cross = `On the very high path it ${when(cHi)}; on the low path it ${when(cLo)}.`;
    }
    d3.select("#takeaway").html(
      `<strong>${region}:</strong> by 2081-2100 this region warms about <strong>${fmt(loR)}°C</strong> on the low path ` +
      `and about <strong>${fmt(hiR)}°C</strong> on the very high path, a gap of <strong>${(hiR - loR).toFixed(1)}°C</strong>. ` +
      cross);
  }

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
      .attr("fill", d => colors[d[0]]).attr("opacity", 0.12)
      .transition().duration(500).attr("d", d => area(d[1]));

    plot.selectAll(".path").data(byScenario, d => d[0])
      .join("path").attr("class", "path")
      .attr("fill", "none").attr("stroke", d => colors[d[0]]).attr("stroke-width", 2)
      .transition().duration(500).attr("d", d => line(d[1]));

    // +2°C reference line, shown only when it fits in the current y range
    const showRef = y.domain()[0] < THRESHOLD && y.domain()[1] > THRESHOLD;
    ref.selectAll("line").data(showRef ? [THRESHOLD] : []).join("line")
      .attr("x1", 0).attr("x2", width)
      .attr("stroke", "#333").attr("stroke-dasharray", "2 4").attr("opacity", 0.6)
      .transition().duration(500).attr("y1", y(THRESHOLD)).attr("y2", y(THRESHOLD));
    ref.selectAll("text").data(showRef ? [THRESHOLD] : []).join("text")
      .attr("x", 4).attr("font-size", 11).attr("fill", "#333").text("+2°C")
      .transition().duration(500).attr("y", y(THRESHOLD) - 4);

    // end-of-line labels for the future paths, nudged apart so they don't overlap
    const labels = byScenario.filter(d => d[0] !== "historical")
      .map(([k, rows]) => ({ k, y: y(rows[rows.length - 1].median), x: x(rows[rows.length - 1].year) + 5 }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < 14) labels[i].y = labels[i - 1].y + 14;
    }
    plot.selectAll(".label").data(labels, d => d.k)
      .join("text").attr("class", "label")
      .attr("font-size", 12).attr("font-weight", 600).attr("dominant-baseline", "middle")
      .attr("fill", d => d.k === "ssp245" ? "#d4861f" : colors[d.k]).text(d => shortNames[d.k])
      .transition().duration(500)
      .attr("x", d => d.x).attr("y", d => d.y);

    takeaway(region);
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

      // highlight: model-range bar + dot on each path at this year
      hoverMarks.style("display", null);
      hoverMarks.selectAll(".hover-range").data(rows, d => d.scenario)
        .join("line").attr("class", "hover-range")
        .attr("x1", x(year)).attr("x2", x(year))
        .attr("y1", d => y(d.low)).attr("y2", d => y(d.high))
        .attr("stroke", d => colors[d.scenario]).attr("stroke-width", 6)
        .attr("stroke-linecap", "round").attr("opacity", 0.35);
      hoverMarks.selectAll(".hover-dot").data(rows, d => d.scenario)
        .join("circle").attr("class", "hover-dot")
        .attr("cx", x(year)).attr("cy", d => y(d.median)).attr("r", 5.5)
        .attr("fill", d => colors[d.scenario])
        .attr("stroke", "#fff").attr("stroke-width", 2);

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
      hoverMarks.style("display", "none");
      tooltip.style("display", "none");
    });

  // drawn on top of the hover area, but ignores the mouse so hovering keeps working
  const hoverMarks = svg.append("g")
    .style("pointer-events", "none")
    .style("display", "none");

  // start on a familiar region
  const start = regions.includes("W.North-America") ? "W.North-America" : regions[0];
  select.property("value", start);
  update(start);
});
