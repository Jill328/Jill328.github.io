const form = document.getElementById("search-form");
const input = document.getElementById("query");
const useFEl = document.getElementById("useF");   
const cityEl = document.getElementById("city-name");
const tempEl = document.getElementById("temperature");
const wxIconEl = document.getElementById("weather-icon");
const windIconEl = document.getElementById("wind-icon");
const windSpeedEl = document.getElementById("wind-speed");
const resultSection = document.getElementById("result");

// Helpers

const titleCase = (s) =>
  s.replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

function setStatus(msg) {
  let statusEl = document.getElementById("status-line");
  if (!statusEl) {
    statusEl = document.createElement("p");
    statusEl.id = "status-line";
    statusEl.style.marginTop = "0.5rem";
    statusEl.style.opacity = "0.8";
    resultSection.appendChild(statusEl);
  }
  statusEl.textContent = msg || "";
}

// Map Open-Meteo weather codes → Erik Flowers Weather Icons classes
const WEATHER_ICON_MAP = {
  0:  "wi-day-sunny",
  1:  "wi-day-sunny-overcast",
  2:  "wi-cloud",
  3:  "wi-cloudy",
  45: "wi-fog",
  48: "wi-fog",
  51: "wi-sprinkle",
  53: "wi-sprinkle",
  55: "wi-sprinkle",
  56: "wi-rain-mix",
  57: "wi-rain-mix",
  61: "wi-showers",
  63: "wi-rain",
  65: "wi-rain",
  66: "wi-rain-mix",
  67: "wi-rain-mix",
  71: "wi-snow",
  73: "wi-snow",
  75: "wi-snow",
  77: "wi-snowflake-cold",
  80: "wi-showers",
  81: "wi-showers",
  82: "wi-showers",
  85: "wi-snow-wind",
  86: "wi-snow-wind",
  95: "wi-thunderstorm",
  96: "wi-storm-showers",
  99: "wi-storm-showers"
};
const iconForWeatherCode = (code) => WEATHER_ICON_MAP[code] || "wi-na";

async function geocodeCity(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=en&format=json`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = await res.json();
  if (!data.results || data.results.length === 0)
    throw new Error("No results for that city.");

  const { latitude, longitude, name, country, admin1 } = data.results[0];
  return { lat: latitude, lon: longitude, label: [name, admin1, country].filter(Boolean).join(", ") };
}

async function fetchCurrentWeather(lat, lon, units) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&current_weather=true` +
    `&temperature_unit=${units.temp}` +
    `&windspeed_unit=${units.wind}` +
    `&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);
  const data = await res.json();
  if (!data.current_weather) throw new Error("No current weather in response.");
  return data.current_weather; // { temperature, windspeed, winddirection, weathercode, is_day, ... }
}


function renderWeather(cityLabel, cw, units) {
  const tUnit = units.temp === "fahrenheit" ? "°F" : "°C";
  const wUnit = units.wind === "mph" ? "mph" : "km/h";

  // City + temperature
  cityEl.textContent = cityLabel;
  tempEl.textContent = `${Math.round(cw.temperature)}${tUnit}`;

  // Icon
  const iconClass = iconForWeatherCode(cw.weathercode);
  wxIconEl.className = `wi ${iconClass}`;

  // Wind 
  const deg = Math.round(Number(cw.winddirection) || 0);
  windIconEl.className = `wi wi-wind towards-${deg}-deg`;
  windSpeedEl.textContent = `${Math.round(cw.windspeed)} ${wUnit}`;


  applyTheme(cw.weathercode, cw.is_day);

  setStatus(`Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`);
}

function applyTheme(code, isDay) {
  const body = document.body;
  body.classList.remove(
    "theme-sunny","theme-cloudy","theme-rain","theme-storm","theme-snow","theme-fog","is-night"
  );

  let theme = "theme-cloudy";
  if ([0,1,2].includes(code)) theme = "theme-sunny";
  if ([3,45,48].includes(code)) theme = "theme-fog";
  if ([51,53,55,61,63,65,80,81,82].includes(code)) theme = "theme-rain";
  if ([71,73,75,77,85,86].includes(code)) theme = "theme-snow";
  if ([95,96,99].includes(code)) theme = "theme-storm";

  body.classList.add(theme);
  if (isDay === 0) body.classList.add("is-night");
}


function setLoading(on) {
  document.getElementById("result")?.classList.toggle("loading", !!on);
}


useFEl?.addEventListener("change", () => {
  const thumb = document.querySelector(".switch .thumb");
  if (thumb) thumb.textContent = useFEl.checked ? "°F" : "°C";
});

//Events
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const raw = input.value || "";
  const city = titleCase(raw);
  if (!city) {
    setStatus("Please enter a city (e.g., Dallas).");
    input.focus();
    return;
  }

  // Determine units based on checkbox
  const units = useFEl && useFEl.checked
    ? { temp: "fahrenheit", wind: "mph" }
    : { temp: "celsius",    wind: "kmh" };

  // Button state + loading shimmer
  const prevBtnText = e.submitter ? e.submitter.textContent : null;
  if (e.submitter) e.submitter.textContent = "Loading…";
  setStatus("Looking up location…");
  setLoading(true);             

  try {
    const { lat, lon, label } = await geocodeCity(city);
    setStatus("Fetching current weather…");
    const cw = await fetchCurrentWeather(lat, lon, units);
    renderWeather(label, cw, units);
  } catch (err) {
    console.error(err);
    setStatus(err.message || "Something went wrong. Please try again.");
  } finally {
    if (e.submitter && prevBtnText !== null) e.submitter.textContent = prevBtnText;
    setLoading(false);           // ✅ NEW: stop shimmer
  }
});

// Auto-load a default city so the UI shows something on first load
window.addEventListener("DOMContentLoaded", () => {
  input.value = "New Orleans";
  form.dispatchEvent(new Event("submit"));
});

// Also re-fetch when the user toggles units (if there’s a city present)
useFEl?.addEventListener("change", () => {
  if ((input.value || "").trim()) {
    form.dispatchEvent(new Event("submit"));
  }
});

