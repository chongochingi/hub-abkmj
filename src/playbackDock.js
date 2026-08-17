import { LOOP_SPEED_OPTIONS } from "./config.js";

let dock = null;

function ensureDock() {
  if (dock) return dock;
  dock = document.createElement("div");
  dock.id = "playback-dock";
  dock.className = "playback-dock";
  dock.hidden = true;
  document.body.appendChild(dock);
  return dock;
}

function syncDockVisibility() {
  const root = ensureDock();
  const any = [...root.querySelectorAll(".playback-track")].some((el) => !el.hidden);
  root.hidden = !any;
}

function optionList(options, valueKey, selected) {
  return options
    .map((opt) => {
      const value = opt[valueKey];
      return `<option value="${value}" ${value === selected ? "selected" : ""}>${opt.label}</option>`;
    })
    .join("");
}

/**
 * Mount a radar/satellite track into the shared bottom playback box.
 */
export function mountPlaybackTrack({
  id,
  label,
  loopOptions,
  loopMinutes,
  speed = 1,
  playLabel,
}) {
  const root = ensureDock();
  let track = root.querySelector(`[data-track="${id}"]`);
  if (!track) {
    track = document.createElement("div");
    track.className = "playback-track";
    track.dataset.track = id;
    track.hidden = true;
    track.innerHTML = `
      <span class="playback-kind">${label}</span>
      <button type="button" class="play-btn" aria-label="Play ${playLabel} loop">Play</button>
      <div class="radar-clock">Live</div>
      <label class="radar-loop-label">
        Past
        <select class="radar-loop" aria-label="${playLabel} lookback">
          ${optionList(loopOptions, "minutes", loopMinutes)}
        </select>
      </label>
      <label class="radar-loop-label">
        Speed
        <select class="radar-speed" aria-label="${playLabel} speed">
          ${optionList(LOOP_SPEED_OPTIONS, "id", speed)}
        </select>
      </label>
    `;
    root.appendChild(track);
  }

  return {
    track,
    playBtn: track.querySelector(".play-btn"),
    clockEl: track.querySelector(".radar-clock"),
    loopSelect: track.querySelector(".radar-loop"),
    speedSelect: track.querySelector(".radar-speed"),
    setVisible(on) {
      track.hidden = !on;
      syncDockVisibility();
    },
  };
}
