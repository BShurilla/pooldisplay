async function fetchData() {
  const res = await fetch("http://homeassistant.local:8123/api/states", {
    headers: {
      "Authorization": "Bearer YOUR_LONG_LIVED_ACCESS_TOKEN",
    },
  });
  const data = await res.json();
  document.getElementById("pool-temp").textContent = data.find(x => x.entity_id === "sensor.pool_temperature")?.state;
  document.getElementById("rpm").textContent = data.find(x => x.entity_id === "sensor.pool_pump_rpm")?.state;
  document.getElementById("flow").textContent = data.find(x => x.entity_id === "sensor.pool_flow_gpm")?.state;
}

document.getElementById("pump-toggle").addEventListener("click", async () => {
  await fetch("http://homeassistant.local:8123/api/services/switch/toggle", {
    method: "POST",
    headers: {
      "Authorization": "Bearer YOUR_LONG_LIVED_ACCESS_TOKEN",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ entity_id: "switch.pool_pump" })
  });
});

setInterval(fetchData, 5000);
fetchData();
