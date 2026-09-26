const COLORS = {
  text: "#e8edf2",
  muted: "#8793a2",
  green: "#66c89b",
  amber: "#f0b85d",
  red: "#f07772",
  grid: "#ffffff12",
};

const gaugeChartElement = document.querySelector("#gauge-chart");
const gaugeEmpty = document.querySelector("#gauge-empty");
const gaugeMessage = document.querySelector("#gauge-message");
const gaugeTitle = document.querySelector("#gauge-title");
const gaugeDescription = document.querySelector("#gauge-description");
const gaugeMetric = document.querySelector("#gauge-metric");
const gaugeLegend = document.querySelector("#gauge-legend");
const gaugeJson = document.querySelector("#gauge-json");
const gaugeButton = document.querySelector("#load-gauge");
const studyForm = document.querySelector("#study-form");
const studyDate = document.querySelector("#study-date");
const studentsChartElement = document.querySelector("#students-chart");
const studentsEmpty = document.querySelector("#students-empty");
const studentsMessage = document.querySelector("#students-message");
const studyButton = document.querySelector("#load-study");

const GAUGE_ENDPOINTS = {
  "bike-speed": "/api/gauges/bike-speed",
  "student-score": "/api/gauges/student-score",
};
const TONE_COLORS = {
  good: COLORS.green,
  warning: COLORS.amber,
  danger: COLORS.red,
};
const TONE_CLASSES = {
  good: "green",
  warning: "amber",
  danger: "red",
};

let gaugeChart;
let studentsChart;

function setBusy(button, busy, busyLabel, idleLabel) {
  button.disabled = busy;
  button.querySelector("span:first-child").textContent = busy ? busyLabel : idleLabel;
}

async function readApiResponse(response) {
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(detail);
  }
  return response.json();
}

function renderGauge(gauge) {
  if (gauge.kind !== "gauge") {
    throw new Error(`Unsupported visualization type: ${gauge.kind}`);
  }
  const { metric, scale, bands } = gauge;
  const range = scale.max - scale.min;
  if (range <= 0 || metric.value < scale.min || metric.value > scale.max || bands.length === 0) {
    throw new Error("The API returned an invalid gauge scale or value.");
  }

  gaugeChartElement.hidden = false;
  gaugeEmpty.hidden = true;
  gaugeChart ??= echarts.init(gaugeChartElement);
  gaugeTitle.textContent = metric.label;
  gaugeDescription.textContent = `${metric.label} · ${metric.key}`;
  gaugeChartElement.setAttribute("aria-label", `${metric.label} gauge chart`);

  gaugeLegend.replaceChildren();
  for (const band of bands) {
    const item = document.createElement("span");
    const dot = document.createElement("i");
    dot.className = `legend-dot ${TONE_CLASSES[band.tone] || ""}`;
    const label = document.createElement("span");
    label.textContent = `${band.start}–${band.end} ${metric.unit}`;
    item.append(dot, label);
    gaugeLegend.append(item);
  }

  // Convert semantic tone tokens and numeric ranges into ECharts-specific settings here.
  const colorStops = bands.map((band) => [
    (band.end - scale.min) / range,
    TONE_COLORS[band.tone],
  ]);
  gaugeChart.setOption({
    animationDuration: 850,
    series: [{
      type: "gauge",
      min: scale.min,
      max: scale.max,
      startAngle: 210,
      endAngle: -30,
      center: ["50%", "62%"],
      radius: "88%",
      axisLine: { lineStyle: { width: 17, color: colorStops, cap: "round" } },
      progress: { show: false },
      pointer: { show: true, length: "61%", width: 4, itemStyle: { color: "#f3f5f7" } },
      anchor: { show: true, size: 10, itemStyle: { color: "#f3f5f7", borderColor: "#2b3542", borderWidth: 4 } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: true, offsetCenter: [0, "40%"], color: COLORS.muted, fontSize: 10 },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, "8%"],
        color: COLORS.text,
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "Manrope, sans-serif",
        formatter: (value) => `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} ${metric.unit}`,
      },
      data: [{ value: metric.value, name: metric.label.toUpperCase() }],
    }],
  }, true);
}

async function loadGauge() {
  const endpoint = GAUGE_ENDPOINTS[gaugeMetric.value];
  if (!endpoint) {
    gaugeMessage.textContent = "Choose a supported gauge metric.";
    return;
  }
  setBusy(gaugeButton, true, "Loading", "Load gauge");
  gaugeMessage.textContent = "Asking the API for a fresh value…";
  try {
    const gauge = await readApiResponse(await fetch(endpoint));
    // Show the wire response as received; ECharts adaptation stays in renderGauge.
    gaugeJson.textContent = JSON.stringify(gauge, null, 2);
    renderGauge(gauge);
    gaugeMessage.textContent = `${gauge.metric.label} loaded from the API.`;
  } catch (error) {
    gaugeMessage.textContent = error.message || "Could not load this gauge.";
  } finally {
    setBusy(gaugeButton, false, "Loading", "Load gauge");
  }
}

function renderStudents(students) {
  studentsChartElement.hidden = false;
  studentsEmpty.hidden = true;
  studentsChart ??= echarts.init(studentsChartElement);
  const height = students.length * 24 + 52;
  studentsChartElement.style.height = `${Math.max(195, height)}px`;
  studentsChart.setOption({
    animationDuration: 650,
    grid: { top: 13, right: 28, bottom: 30, left: 92, containLabel: false },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#202a37",
      borderColor: "#394555",
      textStyle: { color: COLORS.text, fontFamily: "DM Sans, sans-serif", fontSize: 11 },
      formatter: (items) => `${items[0].name}<br/><strong>${items[0].value} hours</strong>`,
    },
    xAxis: {
      type: "value",
      min: 0,
      max: 10,
      interval: 2,
      axisLine: { lineStyle: { color: "#526071" } },
      axisTick: { show: false },
      axisLabel: { color: COLORS.muted, fontSize: 9, formatter: (value) => `${value}h` },
      splitLine: { lineStyle: { color: COLORS.grid, type: "dashed" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: students.map((student) => student.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#abb4c0", fontSize: 9, width: 82, overflow: "truncate", margin: 10 },
    },
    series: [{
      type: "bar",
      data: students.map((student) => student.hours),
      barWidth: 9,
      showBackground: true,
      backgroundStyle: { color: "#ffffff08", borderRadius: 5 },
      itemStyle: { color: "#8d7bc2", borderRadius: [0, 5, 5, 0] },
      emphasis: { itemStyle: { color: "#b6a3ec" } },
      markLine: {
        silent: true,
        symbol: "none",
        label: {
          show: true,
          position: "insideEndTop",
          distance: 3,
          fontSize: 8,
          formatter: (params) => `${params.name}`,
        },
        data: [
          { xAxis: 2, name: "2h", lineStyle: { color: COLORS.amber, type: "dashed", width: 1 }, label: { color: COLORS.amber } },
          { xAxis: 7, name: "7h", lineStyle: { color: COLORS.amber, type: "dashed", width: 1 }, label: { color: COLORS.amber } },
          { xAxis: 8, name: "8h", lineStyle: { color: COLORS.red, type: "dashed", width: 1 }, label: { color: COLORS.red } },
        ],
      },
    }],
  }, true);
  studentsChart.resize();
}

async function loadStudents(event) {
  event.preventDefault();
  if (!studyDate.value) {
    studyDate.reportValidity();
    return;
  }
  setBusy(studyButton, true, "Loading", "Load class");
  studentsMessage.textContent = "Asking the API for this day’s class…";
  try {
    const result = await readApiResponse(await fetch("/api/students/study-hours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: studyDate.value }),
    }));
    renderStudents(result.students);
    const formattedDate = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(`${result.date}T00:00:00Z`));
    studentsMessage.textContent = `${result.students.length} students · ${formattedDate}`;
  } catch (error) {
    studentsMessage.textContent = error.message || "Could not load study hours.";
  } finally {
    setBusy(studyButton, false, "Loading", "Load class");
  }
}

studyDate.value = new Date().toISOString().slice(0, 10);
gaugeButton.addEventListener("click", loadGauge);
gaugeMetric.addEventListener("change", () => {
  gaugeMessage.textContent = "Selection changed. Load the gauge to refresh its data.";
});
studyForm.addEventListener("submit", loadStudents);

window.addEventListener("resize", () => {
  gaugeChart?.resize();
  studentsChart?.resize();
});
