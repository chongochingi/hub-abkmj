import { ODOT_STREAM_URL } from "./config.js";

const params = new URLSearchParams(location.search);
const camId = params.get("id");
const title = params.get("title") || "ODOT Camera";
const sub = params.get("sub") || "";

document.getElementById("title").textContent = title;
document.title = title;
document.getElementById("sub").textContent = sub;

const video = document.getElementById("video");
const loading = document.getElementById("loading");
const errEl = document.getElementById("err");

function showError(msg) {
  loading.hidden = true;
  video.hidden = true;
  errEl.textContent = msg;
  errEl.hidden = false;
}

async function start() {
  if (!camId) {
    showError("Missing camera id.");
    return;
  }

  let streamSrc;
  try {
    const url = ODOT_STREAM_URL.replace("{id}", camId);
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Stream HTTP ${res.status}`);
    const data = await res.json();
    streamSrc = data.streamSrc;
  } catch (err) {
    showError(`Stream unavailable: ${err.message}`);
    return;
  }

  if (!streamSrc) {
    showError("No stream URL for this camera.");
    return;
  }

  try {
    const { default: Hls } = await import("hls.js");
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      let manifested = false;
      hls.loadSource(streamSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        manifested = true;
        loading.hidden = true;
        errEl.hidden = true;
        video.hidden = false;
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data?.fatal && manifested) {
          showError("Stream interrupted or unavailable.");
        }
      });
      window.addEventListener("beforeunload", () => hls.destroy());
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamSrc;
      loading.hidden = true;
      video.hidden = false;
      video.play().catch(() => {});
    } else {
      showError("This browser cannot play HLS streams.");
    }
  } catch (err) {
    showError(`Playback error: ${err.message}`);
  }
}

start();
