import { fetchSpcSounding, spcStationId } from "./sounding.js";

const params = new URLSearchParams(location.search);
const stationId = params.get("station");
const title = params.get("title") || (stationId ? `${spcStationId(stationId)} SPC Skew-T` : "SPC Skew-T");

document.getElementById("title").textContent = title;
document.title = title;

const loading = document.getElementById("loading");
const img = document.getElementById("plot");
const sub = document.getElementById("sub");

async function start() {
  if (!stationId) {
    loading.textContent = "Missing station id.";
    loading.classList.add("err");
    return;
  }

  try {
    const sounding = await fetchSpcSounding(stationId);
    if (!sounding?.plotUrl) {
      loading.textContent = "No recent SPC observed sounding for this site.";
      loading.classList.add("err");
      return;
    }

    const when = new Date(sounding.valid);
    const whenText = Number.isNaN(when.getTime())
      ? sounding.cycle
      : when.toLocaleString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          month: "short",
          day: "numeric",
          timeZoneName: "short",
        });
    sub.innerHTML = `${whenText} · <a href="${sounding.pageUrl}" target="_blank" rel="noreferrer">SPC page</a>`;

    img.onload = () => {
      loading.hidden = true;
      img.hidden = false;
    };
    img.onerror = () => {
      loading.textContent = "SPC Skew-T image failed to load.";
      loading.classList.add("err");
    };
    img.src = sounding.plotUrl;
  } catch (err) {
    loading.textContent = err.message || "Sounding unavailable.";
    loading.classList.add("err");
  }
}

start();
