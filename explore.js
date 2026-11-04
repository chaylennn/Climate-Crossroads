// Exploratory graphs for Climate Crossroads (D3 only)
// Reads the same data/climate_paths.csv used by the main chart.

const colors = {
  historical: "#555", ssp126: "#1a9850", ssp245: "#fdae61",
  ssp370: "#f46d43", ssp585: "#a50026"
};
const names = {
  historical: "Historical",
  ssp126: "SSP1-2.6 (low)",
  ssp245: "SSP2-4.5 (middle)",
  ssp370: "SSP3-7.0 (high)",
  ssp585: "SSP5-8.5 (very high)"
};
const futures = ["ssp126", "ssp245", "ssp370", "ssp585"];
const W = 850;
const f1 = d3.format(".1f");

// helper: svg with margins, returns inner group and size
function makeSvg(sel, height, margin) {
  const svg = d3.select(sel).append("svg").attr("viewBox", [0, 0, W, height]);
  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  return { svg, g, w: W - margin.left - margin.right, h: height - margin.top - margin.bottom };
}

// helper: color legend for scenarios
function legend(g, keys, x, y) {
  const item = g.append("g").attr("transform", `translate(${x},${y})`)
    .selectAll("g").data(keys).join("g")
    .attr("transform", (d, i) => `translate(0,${i * 18})`);
  item.append("rect").attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", d => colors[d]);
  item.append("text").attr("x", 18).attr("y", 10).attr("font-size", 12).text(d => names[d]);
}

function axisLabel(g, text, x, y, rotate = false) {
  g.append("text")
    .attr("x", x).attr("y", y)
    .attr("transform", rotate ? "rotate(-90)" : null)
    .attr("text-anchor", "middle").attr("font-size", 12).attr("fill", "#333")
    .text(text);
}

d3.csv("data/climate_paths.csv", d3.autoType).then(raw => {
  const data = raw.filter(d => d.year <= 2100);
  const regions = [...new Set(data.map(d => d.region))];
  const byKey = d3.group(data, d => d.region, d => d.scenario);

  const rowsFor = (region, scen) => (byKey.get(region) && byKey.get(region).get(scen)) || [];
  // mean of a field over 2081-2100
  const late = (region, scen, field = "median") =>
    d3.mean(rowsFor(region, scen).filter(d => d.year >= 2081), d => d[field]);

  fig1(data);
  fig2(regions, late);
  fig3(regions, late);
  fig4(regions, rowsFor);
  fig5(regions, rowsFor);
  fig6(regions, late);
});

// 1. Average paths across all regions
function fig1(data) {
  const series = d3.rollups(
    data,
    v => ({ median: d3.mean(v, d => d.median), low: d3.mean(v, d => d.low), high: d3.mean(v, d => d.high) }),
    d => d.scenario, d => d.year
  ).map(([scen, yrs]) => [scen, yrs.map(([year, o]) => ({ year, ...o })).sort((a, b) => a.year - b.year)]);

  const { g, w, h } = makeSvg("#fig1", 420, { top: 20, right: 30, bottom: 45, left: 55 });
  const all = series.flatMap(s => s[1]);
  const x = d3.scaleLinear().domain(d3.extent(all, d => d.year)).range([0, w]);
  const y = d3.scaleLinear().domain([d3.min(all, d => d.low), d3.max(all, d => d.high)]).nice().range([h, 0]);

  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y));
  g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(0)).attr("y2", y(0)).attr("stroke", "#ccc");
  g.append("line").attr("x1", x(2015)).attr("x2", x(2015)).attr("y1", 0).attr("y2", h)
    .attr("stroke", "#999").attr("stroke-dasharray", "4 4");
  g.append("text").attr("x", x(2015) + 5).attr("y", 12).attr("font-size", 12).attr("fill", "#666").text("Paths split");

  const area = d3.area().x(d => x(d.year)).y0(d => y(d.low)).y1(d => y(d.high));
  const line = d3.line().x(d => x(d.year)).y(d => y(d.median));
  g.selectAll(".band").data(series).join("path")
    .attr("fill", d => colors[d[0]]).attr("opacity", 0.15).attr("d", d => area(d[1]));
  g.selectAll(".line").data(series).join("path")
    .attr("fill", "none").attr("stroke", d => colors[d[0]]).attr("stroke-width", 2).attr("d", d => line(d[1]));

  axisLabel(g, "Warming vs 1850-1900 (°C)", -h / 2, -40, true);
  axisLabel(g, "Year", w / 2, h + 38);
  legend(g, ["historical", ...futures], 10, 10);
}

// 2. Ranked bar chart of late-century warming under SSP5-8.5
function fig2(regions, late) {
  const rows = regions.map(r => ({ region: r, v: late(r, "ssp585") }))
    .filter(d => d.v != null).sort((a, b) => b.v - a.v);
  const { g, w, h } = makeSvg("#fig2", rows.length * 16 + 70, { top: 30, right: 50, bottom: 40, left: 150 });

  const y = d3.scaleBand().domain(rows.map(d => d.region)).range([0, h]).padding(0.2);
  const x = d3.scaleLinear().domain([0, d3.max(rows, d => d.v)]).nice().range([0, w]);
  const color = d3.scaleSequential(d3.interpolateReds).domain([0, x.domain()[1] * 1.15]);

  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y).tickSize(0)).call(a => a.select(".domain").remove())
    .selectAll("text").attr("font-size", 10);

  g.selectAll("rect").data(rows).join("rect")
    .attr("y", d => y(d.region)).attr("height", y.bandwidth())
    .attr("x", 0).attr("width", d => x(d.v)).attr("fill", d => color(d.v));
  g.selectAll(".val").data(rows).join("text")
    .attr("x", d => x(d.v) + 4).attr("y", d => y(d.region) + y.bandwidth() / 2 + 3)
    .attr("font-size", 10).attr("fill", "#444").text(d => f1(d.v));

  axisLabel(g, "Warming by 2081-2100 under SSP5-8.5 (°C)", w / 2, h + 34);
}

// 3. Dumbbell: low vs very high emissions, sorted by gap
function fig3(regions, late) {
  const rows = regions.map(r => ({ region: r, lo: late(r, "ssp126"), hi: late(r, "ssp585") }))
    .filter(d => d.lo != null && d.hi != null)
    .map(d => ({ ...d, gap: d.hi - d.lo }))
    .sort((a, b) => b.gap - a.gap);
  const { g, w, h } = makeSvg("#fig3", rows.length * 16 + 90, { top: 50, right: 70, bottom: 40, left: 150 });

  const y = d3.scalePoint().domain(rows.map(d => d.region)).range([0, h]).padding(0.5);
  const x = d3.scaleLinear().domain([0, d3.max(rows, d => d.hi)]).nice().range([0, w]);

  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y).tickSize(0)).call(a => a.select(".domain").remove())
    .selectAll("text").attr("font-size", 10);

  const row = g.selectAll(".row").data(rows).join("g").attr("transform", d => `translate(0,${y(d.region)})`);
  row.append("line").attr("x1", d => x(d.lo)).attr("x2", d => x(d.hi)).attr("stroke", "#bbb").attr("stroke-width", 2);
  row.append("circle").attr("cx", d => x(d.lo)).attr("r", 4.5).attr("fill", colors.ssp126);
  row.append("circle").attr("cx", d => x(d.hi)).attr("r", 4.5).attr("fill", colors.ssp585);
  row.append("text").attr("x", d => x(d.hi) + 8).attr("y", 3.5).attr("font-size", 10).attr("fill", "#666")
    .text(d => `+${f1(d.gap)}`);
  row.append("title").text(d => `${d.region}: ${f1(d.lo)}°C (low) vs ${f1(d.hi)}°C (very high), gap ${f1(d.gap)}°C`);

  axisLabel(g, "Warming by 2081-2100 (°C)", w / 2, h + 34);
  g.append("text").attr("x", w + 8).attr("y", -10).attr("font-size", 10).attr("fill", "#666").text("gap");
  legend(g, ["ssp126", "ssp585"], 0, -44);
}

// 4. Year each region first reaches +2°C, per scenario
function fig4(regions, rowsFor) {
  const THRESH = 2;
  const rows = regions.map(r => {
    const years = {};
    futures.forEach(s => {
      const series = [...rowsFor(r, "historical"), ...rowsFor(r, s)].sort((a, b) => a.year - b.year);
      const hit = series.find(d => d.median >= THRESH);
      years[s] = hit ? hit.year : null;
    });
    return { region: r, years };
  });
  // sort by SSP5-8.5 crossing year (never-crossing last)
  rows.sort((a, b) => (a.years.ssp585 ?? 9999) - (b.years.ssp585 ?? 9999));

  const { g, w, h } = makeSvg("#fig4", rows.length * 16 + 110, { top: 80, right: 20, bottom: 40, left: 150 });
  const found = rows.flatMap(d => futures.map(s => d.years[s])).filter(v => v != null);
  const xmin = Math.floor(Math.min(2010, d3.min(found) ?? 2010) / 10) * 10;
  const plotW = w - 90;
  const x = d3.scaleLinear().domain([xmin, 2100]).range([0, plotW]);
  const nullX = w - 35;
  const y = d3.scalePoint().domain(rows.map(d => d.region)).range([0, h]).padding(0.5);

  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  g.append("g").call(d3.axisLeft(y).tickSize(0)).call(a => a.select(".domain").remove())
    .selectAll("text").attr("font-size", 10);
  g.append("g").selectAll("line").data(rows).join("line")
    .attr("x1", 0).attr("x2", w).attr("y1", d => y(d.region)).attr("y2", d => y(d.region))
    .attr("stroke", "#f0f0f0");
  g.append("line").attr("x1", x(2015)).attr("x2", x(2015)).attr("y1", 0).attr("y2", h)
    .attr("stroke", "#999").attr("stroke-dasharray", "4 4");
  g.append("line").attr("x1", plotW + 30).attr("x2", plotW + 30).attr("y1", 0).attr("y2", h).attr("stroke", "#ddd");
  g.append("text").attr("x", nullX).attr("y", -8).attr("text-anchor", "middle")
    .attr("font-size", 10).attr("fill", "#666").text("not by 2100");

  const dots = rows.flatMap(d => futures.map((s, i) => ({ region: d.region, scen: s, year: d.years[s], i })));
  g.selectAll(".dot").data(dots).join("circle")
    .attr("cx", d => d.year == null ? nullX + (d.i - 1.5) * 7 : x(d.year))
    .attr("cy", d => y(d.region) + (d.i - 1.5) * 2.5)
    .attr("r", 4).attr("fill", d => colors[d.scen]).attr("opacity", 0.85)
    .append("title").text(d => `${d.region}, ${names[d.scen]}: ${d.year ?? "not by 2100"}`);

  axisLabel(g, "Year the region first reaches +2°C", plotW / 2, h + 34);
  legend(g, futures, 0, -74);
}

// 5. Heatmap: region x decade, scenario chosen with a dropdown
function fig5(regions, rowsFor) {
  const decades = d3.range(2020, 2100, 10);
  const val = (r, s, dec) => d3.mean(rowsFor(r, s).filter(d => d.year >= dec && d.year < dec + 10), d => d.median);

  // precompute values for every scenario so the color scale is shared
  const vals = {};
  futures.forEach(s => { vals[s] = new Map(regions.map(r => [r, decades.map(dec => val(r, s, dec))])); });
  const max = d3.max(futures.flatMap(s => [...vals[s].values()].flat()));
  const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, max]);

  const order = [...regions].sort((a, b) => (vals.ssp585.get(b).at(-1) ?? 0) - (vals.ssp585.get(a).at(-1) ?? 0));

  const select = d3.select("#fig5").append("select");
  select.selectAll("option").data(futures).join("option")
    .attr("value", d => d).text(d => names[d]).property("selected", d => d === "ssp585");

  const { svg, g, w, h } = makeSvg("#fig5", order.length * 14 + 100, { top: 60, right: 20, bottom: 30, left: 150 });
  const x = d3.scaleBand().domain(decades).range([0, w]).padding(0.04);
  const y = d3.scaleBand().domain(order).range([0, h]).padding(0.06);

  g.append("g").call(d3.axisTop(x).tickFormat(d => `${d}s`).tickSize(0)).call(a => a.select(".domain").remove());
  g.append("g").call(d3.axisLeft(y).tickSize(0)).call(a => a.select(".domain").remove())
    .selectAll("text").attr("font-size", 10);

  const cells = g.selectAll(".cell")
    .data(order.flatMap(r => decades.map((dec, i) => ({ region: r, dec, i }))))
    .join("rect")
    .attr("x", d => x(d.dec)).attr("y", d => y(d.region))
    .attr("width", x.bandwidth()).attr("height", y.bandwidth()).attr("rx", 2);
  cells.append("title");

  // color legend
  const lg = svg.append("g").attr("transform", `translate(${W - 270},10)`);
  const grad = svg.append("defs").append("linearGradient").attr("id", "heat-grad");
  d3.range(0, 1.01, 0.1).forEach(t => grad.append("stop").attr("offset", t).attr("stop-color", color(t * max)));
  lg.append("rect").attr("width", 200).attr("height", 10).attr("fill", "url(#heat-grad)");
  lg.append("g").attr("transform", "translate(0,10)")
    .call(d3.axisBottom(d3.scaleLinear().domain([0, max]).range([0, 200])).ticks(5).tickSize(3))
    .call(a => a.select(".domain").remove()).selectAll("text").attr("font-size", 9);
  lg.append("text").attr("x", 205).attr("y", 9).attr("font-size", 10).text("°C");

  function update(s) {
    cells.transition().duration(500).attr("fill", d => {
      const v = vals[s].get(d.region)[d.i];
      return v == null ? "#eee" : color(v);
    });
    cells.select("title").text(d => {
      const v = vals[s].get(d.region)[d.i];
      return `${d.region}, ${d.dec}s, ${names[s]}: ${v == null ? "n/a" : f1(v) + "°C"}`;
    });
  }
  select.on("change", e => update(e.target.value));
  update("ssp585");
}

// 6. Scatter: warming vs model spread
function fig6(regions, late) {
  const rows = regions.map(r => ({
    region: r,
    warm: late(r, "ssp585"),
    spread: late(r, "ssp585", "high") - late(r, "ssp585", "low")
  })).filter(d => d.warm != null && !isNaN(d.spread));

  const { g, w, h } = makeSvg("#fig6", 440, { top: 20, right: 30, bottom: 50, left: 60 });
  const x = d3.scaleLinear().domain(d3.extent(rows, d => d.warm)).nice().range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(rows, d => d.spread)]).nice().range([h, 0]);

  g.append("g").attr("transform", `translate(0,${h})`).call(d3.axisBottom(x));
  g.append("g").call(d3.axisLeft(y));

  g.selectAll("circle").data(rows).join("circle")
    .attr("cx", d => x(d.warm)).attr("cy", d => y(d.spread))
    .attr("r", 5.5).attr("fill", colors.ssp585).attr("opacity", 0.7)
    .append("title").text(d => `${d.region}: ${f1(d.warm)}°C median, models span ${f1(d.spread)}°C`);

  // label the 4 regions with the most disagreement
  const top = [...rows].sort((a, b) => b.spread - a.spread).slice(0, 4);
  g.selectAll(".lbl").data(top).join("text")
    .attr("x", d => x(d.warm) - 8).attr("y", d => y(d.spread) + 4)
    .attr("text-anchor", "end").attr("font-size", 10).attr("fill", "#444").text(d => d.region);

  axisLabel(g, "Median warming by 2081-2100 under SSP5-8.5 (°C)", w / 2, h + 40);
  axisLabel(g, "Model spread, max minus min (°C)", -h / 2, -45, true);
}
