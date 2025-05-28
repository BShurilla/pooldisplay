const HASS_BASE_URL = process.env.HASS_BASE_URL || 'http://localhost:8123';
const QUICK_CLEAN_WEBHOOK = process.env.QUICK_CLEAN_WEBHOOK || 'your_quick_clean_webhook_id';
let gpmGauge, gphGauge, rpmGauge;
let lastPumpState = "off";
let quickCleanEndTime = null;
let isQuickCleanTimerActive = false;
let isQuickCleanModeActive = false;

function setQuickCleanEndTime(time) {
  quickCleanEndTime = time;
}

function getQuickCleanEndTime() {
  return quickCleanEndTime;
}

function initGauges() {
  if (typeof Gauge === "undefined") {
    console.error("Gauge library not loaded. Ensure gauge.min.js is included.");
    return;
  }

  const gpmGaugeCanvas = document.getElementById("gpm-canvas");
  if (gpmGaugeCanvas) {
    gpmGauge = new Gauge(gpmGaugeCanvas).setOptions({
      angle: -0.2,
      lineWidth: 0.2,
      radiusScale: 0.93,
      pointer: {
        length: 0.5,
        strokeWidth: 0.035,
        color: "#000000"
      },
      colorStart: "#6FADCF",
      colorStop: "#8FC0DA",
      strokeColor: "#E0E0E0",
      highDpiSupport: true,
      staticLabels: {
        font: "10px sans-serif",
        labels: [0, 10, 20, 30, 40, 50, 60, 70],
        color: "#ffffff",
        fractionDigits: 0
      },
      renderTicks: {
        divisions: 5,
        divWidth: 1.1,
        divLength: 0.7,
        divColor: "#333333",
        subDivisions: 3,
        subLength: 0.5,
        subWidth: 0.6,
        subColor: "#666666"
      }
    });
    gpmGauge.maxValue = 70;
    gpmGauge.setMinValue(0);
    gpmGauge.animationSpeed = 32;
  } else {
    console.error("Canvas element 'gpm-canvas' not found");
  }

  const gphGaugeCanvas = document.getElementById("gph-canvas");
  if (gphGaugeCanvas) {
    gphGauge = new Gauge(gphGaugeCanvas).setOptions({
      angle: -0.2,
      lineWidth: 0.2,
      radiusScale: 0.93,
      pointer: {
        length: 0.5,
        strokeWidth: 0.035,
        color: "#000000"
      },
      colorStart: "#6FADCF",
      colorStop: "#8FC0DA",
      strokeColor: "#E0E0E0",
      highDpiSupport: true,
      staticLabels: {
        font: "10px sans-serif",
        labels: [0, 500, 1000, 1500, 2000, 2500, 3000, 3500],
        color: "#ffffff",
        fractionDigits: 0
      },
      renderTicks: {
        divisions: 5,
        divWidth: 1.1,
        divLength: 0.7,
        divColor: "#333333",
        subDivisions: 3,
        subLength: 0.5,
        subWidth: 0.6,
        subColor: "#666666"
      }
    });
    gphGauge.maxValue = 3500;
    gphGauge.setMinValue(0);
    gphGauge.animationSpeed = 32;
  } else {
    console.error("Canvas element 'gph-canvas' not found");
  }

  const rpmGaugeCanvas = document.getElementById("rpm-canvas");
  if (rpmGaugeCanvas) {
    rpmGauge = new Gauge(rpmGaugeCanvas).setOptions({
      angle: -0.2,
      lineWidth: 0.2,
      radiusScale: 0.93,
      pointer: {
        length: 0.5,
        strokeWidth: 0.035,
        color: "#000000"
      },
      colorStart: "#6FADCF",
      colorStop: "#8FC0DA",
      strokeColor: "#E0E0E0",
      highDpiSupport: true,
      staticLabels: {
        font: "10px sans-serif",
        labels: [0, 500, 1000, 1500, 2000, 2500, 3000, 3550],
        color: "#ffffff",
        fractionDigits: 0
      },
      renderTicks: {
        divisions: 5,
        divWidth: 1.1,
        divLength: 0.7,
        divColor: "#333333",
        subDivisions: 3,
        subLength: 0.5,
        subWidth: 0.6,
        subColor: "#666666"
      }
    });
    rpmGauge.maxValue = 3550;
    rpmGauge.setMinValue(0);
    rpmGauge.animationSpeed = 32;
  } else {
    console.error("Canvas element 'rpm-canvas' not found");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (typeof Gauge !== "undefined") {
    initGauges();
  } else {
    console.error("Gauge library not loaded when DOM is ready. Retrying in 1 second...");
    setTimeout(initGauges, 1000);
  }
});

function getWeatherDescription(state) {
  switch (state) {
    case "sunny": return "Sunny";
    case "partlycloudy":
    case "partly_cloudy": return "Partly Cloudy";
    case "cloudy": return "Cloudy";
    case "rainy": return "Rain";
    case "clear-night": return "Clear Night";
    default: return "Unknown";
  }
}

function setStatusLight(id, state) {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`Element with ID '${id}' not found`);
    return;
  }
  el.classList.remove("green", "blue", "red", "yellow", "off");
  if (state === "manual" || state === "blue") {
    el.classList.add("status-light", "blue");
  } else if (state === "schedule" || state === "on" || state === "green") {
    el.classList.add("status-light", "green");
  } else if (state === "alert" || state === "red") {
    el.classList.add("status-light", "red");
  } else if (state === "yellow") {
    el.classList.add("status-light", "yellow");
  } else {
    el.classList.add("status-light", "off");
  }
}

async function fetchData() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("/api/states", {
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    const data = await res.json();

    const quickCleanTimer = data.find(x => x.entity_id === "timer.quick_clean_timer");
    if (quickCleanTimer) {
      isQuickCleanTimerActive = quickCleanTimer.state === "active";
      updateQuickCleanFromTimer(quickCleanTimer);
    } else {
      isQuickCleanTimerActive = false;
    }

    const quickCleanMode = data.find(x => x.entity_id === "script.quick_clean_mode");
    isQuickCleanModeActive = quickCleanMode?.state === "on";

    const poolTempEl = document.getElementById("pool-temp");
    if (poolTempEl) poolTempEl.textContent = data.find(x => x.entity_id === "sensor.temperature_iopool_pool")?.state || "--";

    const airTempEl = document.getElementById("air-temp");
    if (airTempEl) airTempEl.textContent = data.find(x => x.entity_id === "sensor.outdoor_temperature")?.state || "--";

    const weatherState = data.find(x => x.entity_id === "weather.home")?.state || "--";
    const weatherStatusEl = document.getElementById("weather-status");
    if (weatherStatusEl) weatherStatusEl.textContent = getWeatherDescription(weatherState);

    const pumpState = data.find(x => x.entity_id === "sensor.pool_pump_status")?.state || "off";
    setStatusLight("pump-status-info", pumpState === "manual" ? "blue" : pumpState === "schedule" ? "green" : pumpState === "off" ? "off" : "red");

    const rpmEl = document.getElementById("rpm");
    if (rpmEl) rpmEl.textContent = data.find(x => x.entity_id === "sensor.esp32_pool_pump_pump_actual_rpm")?.state || "--";

    const wattsEl = document.getElementById("watts");
    if (wattsEl) wattsEl.textContent = data.find(x => x.entity_id === "sensor.esp32_pool_pump_pump_input_power")?.state || "--";

    const ph = data.find(x => x.entity_id === "sensor.ph_iopool_pool")?.state || "--";
    const orp = data.find(x => x.entity_id === "sensor.orp_iopool_pool")?.state || "--";
    const phEl = document.getElementById("ph");
    if (phEl) phEl.textContent = ph;
    const orpEl = document.getElementById("orp");
    if (orpEl) orpEl.textContent = orp;

    const chemBinary = data.find(x => x.entity_id === "binary_sensor.required_actions_iopool_pool")?.state;
    setStatusLight("chem-status", chemBinary === "on" ? "blue" : chemBinary === "off" ? "green" : "red");

    const orpVal = parseFloat(orp);
    const chemStateEl = document.getElementById("chem-state");
    if (chemStateEl) chemStateEl.textContent = !isNaN(orpVal) && orpVal >= 650 && orpVal <= 800 ? "Ideal" : "Correction Needed";

    setStatusLight("pump-status", (pumpState === "off" || pumpState === "manual") && chemBinary === "off" ? "blue" : pumpState === "schedule" && chemBinary === "off" ? "green" : "yellow");

    let gpmVal = parseFloat(data.find(x => x.entity_id === "sensor.pool_flow_monitor_flow_gpm")?.state);
    const gpmEl = document.getElementById("gpm");
    if (gpmEl) gpmEl.textContent = isNaN(gpmVal) ? "--" : gpmVal;
    if (!isNaN(gpmVal) && gpmGauge) gpmGauge.set(gpmVal);

    let gphVal = parseFloat(data.find(x => x.entity_id === "sensor.pool_flow_monitor_flow_gph")?.state);
    const gphEl = document.getElementById("gph");
    if (gphEl) gphEl.textContent = isNaN(gphVal) ? "--" : gphVal;
    if (!isNaN(gphVal) && gphGauge) gphGauge.set(gphVal);

    let gallonsVal = parseFloat(data.find(x => x.entity_id === "counter.gallons_this_cycle")?.state);
    const gallonsEl = document.getElementById("gallons");
    if (gallonsEl) gallonsEl.textContent = isNaN(gallonsVal) ? "--" : gallonsVal;
    const gallonsBarEl = document.getElementById("gallons-bar");
    if (gallonsBarEl && !isNaN(gallonsVal)) gallonsBarEl.style.width = `${Math.min((gallonsVal / 18000) * 100, 100)}%`;

    let rpmVal = parseFloat(data.find(x => x.entity_id === "sensor.esp32_pool_pump_pump_actual_rpm")?.state);
    const rpmGaugeEl = document.getElementById("rpm-gauge");
    if (rpmGaugeEl) rpmGaugeEl.textContent = isNaN(rpmVal) ? "--" : rpmVal;
    if (!isNaN(rpmVal) && rpmGauge) rpmGauge.set(rpmVal);

    const pumpSwitch = data.find(x => x.entity_id === "switch.esp32_pool_pump_pool_pump_run");
    lastPumpState = pumpSwitch?.state || "off";

    if (isQuickCleanModeActive && !getQuickCleanEndTime()) {
      const endTime = Date.now() + 8 * 60 * 60 * 1000;
      setQuickCleanEndTime(endTime);
    }

    updateButtons(rpmVal, lastPumpState, isQuickCleanModeActive);

    return data;
  } catch (e) {
    console.error("Failed to fetch sensor data:", e);
    return [];
  }
}

function updateQuickCleanFromTimer(stateObj) {
  const btn = document.getElementById("btn-clean");
  const timerSpan = document.getElementById("btn-clean-timer");
  if (!btn || !timerSpan) {
    console.error("Quick clean button or timer span not found");
    return;
  }

  if (stateObj.state === "active" && stateObj.attributes.finishes_at) {
    btn.classList.add("active");
    btn.firstChild.textContent = "Quick Clean On";
    try {
      const end = new Date(stateObj.attributes.finishes_at);
      if (isNaN(end.getTime())) throw new Error("Invalid finishes_at date");
      const now = new Date();
      const remainingMs = end - now;
      if (remainingMs > 0) {
        const hrs = Math.floor(remainingMs / 3600000);
        const mins = Math.floor((remainingMs % 3600000) / 60000);
        const secs = Math.floor((remainingMs % 60000) / 1000);
        timerSpan.textContent = ` - ${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      } else {
        timerSpan.textContent = "";
      }
    } catch (e) {
      console.error("Error parsing finishes_at:", e);
      btn.classList.remove("active");
      btn.firstChild.textContent = "Quick Clean";
      timerSpan.textContent = "";
    }
  } else {
    btn.classList.remove("active");
    btn.firstChild.textContent = "Quick Clean";
    timerSpan.textContent = "";
  }
}

function updateButtons(currentRPM, pumpState, isQuickClean) {
  const rpmButtons = {
    "btn-3000": 3000,
    "btn-2450": 2450,
    "btn-1700": 1700
  };

  for (const [id, rpm] of Object.entries(rpmButtons)) {
    const btn = document.getElementById(id);
    if (!btn) {
      console.error(`Button with ID '${id}' not found`);
      continue;
    }
    if (!isNaN(currentRPM) && Math.abs(currentRPM - rpm) < 50 && pumpState === "on") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  }

  const cleanBtn = document.getElementById("btn-clean");
  if (cleanBtn) {
    const isActive = isQuickClean || isQuickCleanTimerActive;
    cleanBtn.classList.toggle("active", isActive);
  } else {
    console.error("Button 'btn-clean' not found");
  }

  const powerBtn = document.getElementById("btn-power");
  if (powerBtn) {
    if (pumpState === "on") {
      powerBtn.classList.add("power-on");
      powerBtn.classList.remove("power-off");
      powerBtn.textContent = "Pump On";
    } else {
      powerBtn.classList.remove("power-on");
      powerBtn.classList.add("power-off");
      powerBtn.textContent = "Pump Off";
    }
  } else {
    console.error("Button 'btn-power' not found");
  }
}

function debounce(fn, wait) {
  let timeout;
  return async (...args) => {
    clearTimeout(timeout);
    await new Promise(resolve => {
      timeout = setTimeout(resolve, wait);
    });
    return fn(...args);
  };
}

async function sendRPM(rpm) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res1 = await fetch("/api/services/number/set_value", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        entity_id: "number.esp32_pool_pump_pump_target_rpm",
        value: rpm
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res1.ok) throw new Error(`Failed to set RPM }: ${res1.status}`);

    const res2 = await fetch("/api/services/switch/turn_on", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        entity_id: "switch.esp32_pool_pump_pool_pump_run"
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res2.ok) throw new Error(`Failed to turn on pump: ${res2.status}`);
  } catch (e) {
    console.error(`Failed to send RPM ${rpm}:`, e);
    throw e;
  }
}

async function sendQuickClean() {
  {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${HASS_BASE_URL}/api/webhook/${QUICK_CLEAN_WEBHOOK}`, {
      method: "POST',
      headers: {
        "Connection": "keep-alive"
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Failed to start quick clean: ${res.status}`);
  } catch (e) {
    console.error("Failed to send quick clean:", e);
    throw e;
  }
}

async function stopQuickClean() {
  try {
    // Cancel the Quick Clean timer
    const controller1 = new AbortController();
    const timeoutId1 = setTimeout(() => controller1.abort(), 5000);
    const res1 = await fetch("/api/services/time/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        entity_id: "timer.quick_clean_timer"
      }),
      signal: controller1.signal
    });
    clearTimeout(timeoutId1);
    if (!res1.ok) throw new Error(`Failed to cancel quick clean timer: ${res1.status}`);

    // Turn off the pump
    await togglePump("on"); // "on" state triggers turn_off in togglePump

    // Update button state immediately
    const btn = document.getElementById("btn-clean");
    const timerSpan = document.getElementById("btn-clean-timer");
    if (btn && timerSpan) {
      btn.classList.remove("active");
      btn.firstChild.textContent = "Quick Clean";
      timerSpan.textContent = "";
      isQuickCleanTimerActive = false;
      isQuickCleanModeActive = false;
    }
  } catch (e) {
    console.error("Failed to stop quick clean:", e);
    throw e;
  }
}

async function togglePump(currentState) {
  const service = currentState === "on" ? "turn_off" : "turn_on";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`/api/services/switch/${service}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        entity_id: "switch.esp32_pool_pump_pool_pump_run"
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Failed to toggle pump: ${res.status}`);
  } catch (e) {
    console.error(`Failed to toggle pump (${service}):`, e);
    throw e;
  }
}

setInterval(fetchData, 5000);
fetchData();

const btn3000 = document.getElementById("btn-3000");
if (btn3000) btn3000.addEventListener("click", async () => {
  try {
    await debounce(() => sendRPM(3000), 500)();
  } catch (e) {
    console.error("Button click error for btn-3000:", e);
  }
});
else console.error("Button 'btn-3000' not found");

const btn2450 = document.getElementById("btn-2450");
if (btn2450) btn2450.addEventListener("click", async () => {
  try {
    await debounce(() => sendRPM(2450), 500)();
  } catch (e) {
    console.error("Button click error for btn-2450:", e);
  }
});
else console.error("Button 'btn-2450' not found");

const btn1700 = document.getElementById("btn-1700");
if (btn1700) btn1700.addEventListener("click", async () => {
  try {
    await debounce(() => sendRPM(1700), 500)();
  } catch (e) {
    console.error("Button click error for btn-1700:", e);
  }
});
else console.error("Button 'btn-1700' not found");

const btnClean = document.getElementById("btn-clean");
if (btnClean) {
  btnClean.addEventListener("click", async () => {
    try {
      const isActive = isQuickCleanTimerActive || isQuickCleanModeActive;
      await debounce(() => {
        if (isActive) {
          stopQuickClean();
        } else {
          sendQuickClean();
        }
      }, 500)();
    } catch (e) {
      console.error("Button click error for btn-clean:", e);
    }
  });
} else {
  console.error("Button 'btn-clean' not found");
}

const btnPower = document.getElementById("btn-power");
if (btnPower) {
  btnPower.addEventListener("click", async () => {
    try {
      await debounce(() => togglePump(lastPumpState), 500)();
    } catch (e) {
      console.error("Button click error for btn-power:", e);
    }
  });
}
else console.error("Button 'btn-power' not found");