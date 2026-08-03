const MEDIA_BASE_URL = "https://pub-08916786b0ea4c109047b2d37424d0ea.r2.dev";
const MEDIA_CORS_ENABLED = true;
const MEDIA_VERSION = "20260802-cors";
const mediaUrl = (folder, filename) => `${MEDIA_BASE_URL}/${folder}/${filename}?v=${MEDIA_VERSION}`;

const songs = [
  { id: 1, title: "Let’s Do It", file: "LetsDoIt" },
  { id: 2, title: "Drop Your Top", file: "DoprYourTop" },
  { id: 3, title: "Hold Me, Kiss Me", file: "HoldMeKissMe" },
  { id: 4, title: "Funk U Up", file: "FunkUUp" },
  { id: 5, title: "Your Enemy", file: "YourEnemy" },
  { id: 6, title: "I Have to Go", file: "IHaveToGo" },
  { id: 7, title: "The Best Thing in My Life", file: "TheBestThingInMyLife" },
  { id: 8, title: "My Life Is a Movie", file: "MyLifeIsAMovie" },
  { id: 9, title: "Perfect", file: "Perfect" },
  { id: 10, title: "Perfume and Wine", file: "PerfumeAndWine" },
  { id: 11, title: "Places I Can’t Go", file: "PlacesICantGo" },
  { id: 12, title: "Cold Night", file: "ColdNight" },
  { id: 13, title: "Roses on My Grave", file: "RosesOnMyGrave" },
  { id: 14, title: "All These Dreams", file: "AllTheseDreams" },
  { id: 15, title: "Chase the Sun", file: "ChaseTheSun" },
  { id: 16, title: "You a Loser", file: "YouALoser" },
  { id: 17, title: "Devil on My Shoulder", file: "DevilOnMyShoulder" }
].map((song) => ({
  ...song,
  cover: `assets/covers/${song.file}-360.webp`,
  coverLarge: `assets/covers/${song.file}-720.webp`,
  audio: mediaUrl("songs", `${song.file}.mp3`)
}));

function createAudioElement({ withCors = MEDIA_CORS_ENABLED } = {}) {
  const element = new Audio();
  if (withCors) element.crossOrigin = "anonymous";
  element.preload = "metadata";
  return element;
}

let audio = createAudioElement();

const state = {
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  volume: 0.7,
  repeat: false,
  shuffle: false,
  sort: "original"
};

if ("scrollRestoration" in history) history.scrollRestoration = "manual";

const songGrid = document.querySelector("#songGrid");
const player = document.querySelector("#player");
const mainPlayButton = document.querySelector("#mainPlayButton");
const progressRange = document.querySelector("#progressRange");
const volumeRange = document.querySelector("#volumeRange");
const currentTimeLabel = document.querySelector("#currentTime");
const durationTimeLabel = document.querySelector("#durationTime");
const toast = document.querySelector("#toast");
const minimizePlayerButton = document.querySelector("#minimizePlayerButton");
const closePlayerButton = document.querySelector("#closePlayerButton");
const equalizerButton = document.querySelector("#equalizerButton");
const equalizerPanel = document.querySelector("#equalizerPanel");
const equalizerReset = document.querySelector("#equalizerReset");
const bassRange = document.querySelector("#bassRange");
const midRange = document.querySelector("#midRange");
const trebleRange = document.querySelector("#trebleRange");
const projectScrollControl = document.querySelector("#projectScrollControl");
const projectScrollThumb = document.querySelector("#projectScrollThumb");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let projectScrollFrame = 0;

document.querySelector("#songCount").textContent = songs.length;
volumeRange.value = String(state.volume);
volumeRange.style.backgroundSize = `${state.volume * 100}% 100%`;
audio.volume = state.volume;

const DEFAULT_EQUALIZER = Object.freeze({ bass: 5, mid: 3, treble: 1 });
const equalizerState = { ...DEFAULT_EQUALIZER };
let audioContext;
let audioSource;
let equalizerFilters;
let equalizerAnalyser;
let equalizerInitialization;
let equalizerSignalCheck;
let equalizerUnavailable = location.protocol === "file:" || !MEDIA_CORS_ENABLED;
let projectScrollDragOffset = null;

async function ensureAudioGraph() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || equalizerUnavailable) return false;

  if (audioContext && equalizerFilters) {
    if (audioContext.state === "suspended") await audioContext.resume();
    return audioContext.state === "running";
  }

  if (equalizerInitialization) return equalizerInitialization;
  equalizerInitialization = buildAudioGraph(AudioContextClass);
  const isReady = await equalizerInitialization;
  equalizerInitialization = null;
  return isReady;
}

async function buildAudioGraph(AudioContextClass) {
  const nextContext = new AudioContextClass({ latencyHint: "interactive" });
  try {
    if (nextContext.state === "suspended") await nextContext.resume();
    if (nextContext.state !== "running") {
      await nextContext.close();
      return false;
    }

    const nextSource = nextContext.createMediaElementSource(audio);
    const bass = nextContext.createBiquadFilter();
    const mid = nextContext.createBiquadFilter();
    const treble = nextContext.createBiquadFilter();
    const analyser = nextContext.createAnalyser();
    const output = nextContext.createGain();

    bass.type = "lowshelf";
    bass.frequency.value = 180;
    mid.type = "peaking";
    mid.frequency.value = 1000;
    mid.Q.value = 0.85;
    treble.type = "highshelf";
    treble.frequency.value = 4500;
    analyser.fftSize = 512;
    output.gain.value = 1;

    nextSource.connect(bass).connect(mid).connect(treble).connect(analyser).connect(output).connect(nextContext.destination);
    audioContext = nextContext;
    audioSource = nextSource;
    equalizerFilters = { bass, mid, treble };
    equalizerAnalyser = analyser;
    applyEqualizer();
    scheduleEqualizerSignalCheck();
    return true;
  } catch {
    if (nextContext.state !== "closed") await nextContext.close();
    return false;
  }
}

function scheduleEqualizerSignalCheck() {
  clearTimeout(equalizerSignalCheck);
  if (!equalizerAnalyser || audio.paused) return;
  equalizerSignalCheck = window.setTimeout(async () => {
    if (!equalizerAnalyser || audio.paused) return;
    const samples = new Uint8Array(equalizerAnalyser.fftSize);
    equalizerAnalyser.getByteTimeDomainData(samples);
    const hasSignal = samples.some((sample) => Math.abs(sample - 128) > 1);
    if (!hasSignal) {
      equalizerUnavailable = true;
      await restoreNativeAudio();
      resetEqualizerControls();
      showToast("El navegador bloqueó el ecualizador; restauré el audio original");
    }
  }, 900);
}

async function restoreNativeAudio() {
  const previousAudio = audio;
  const source = previousAudio.currentSrc || previousAudio.src;
  const resumeAt = previousAudio.currentTime || 0;
  const shouldResume = state.isPlaying && !previousAudio.paused;

  previousAudio.pause();
  clearTimeout(equalizerSignalCheck);
  try { audioSource?.disconnect(); } catch {}
  try { if (audioContext && audioContext.state !== "closed") await audioContext.close(); } catch {}

  audioContext = undefined;
  audioSource = undefined;
  equalizerFilters = undefined;
  equalizerAnalyser = undefined;

  audio = createAudioElement({ withCors: false });
  audio.volume = state.volume;
  bindAudioEvents(audio);

  if (!source) return;
  audio.src = source;
  audio.load();
  await new Promise((resolve) => {
    const finish = () => resolve();
    audio.addEventListener("loadedmetadata", finish, { once: true });
    window.setTimeout(finish, 800);
  });
  if (Number.isFinite(audio.duration)) audio.currentTime = Math.min(resumeAt, Math.max(0, audio.duration - 0.1));
  if (shouldResume) {
    try { await audio.play(); } catch { state.isPlaying = false; }
  }
  updatePlayer();
}

function resetEqualizerControls() {
  [[bassRange, document.querySelector("#bassValue"), "bass"], [midRange, document.querySelector("#midValue"), "mid"], [trebleRange, document.querySelector("#trebleValue"), "treble"]].forEach(([range, output, key]) => {
    range.value = String(DEFAULT_EQUALIZER[key]);
    updateEqualizerControl(range, output, key);
  });
}

function equalizerUnavailableMessage() {
  return location.protocol === "file:"
    ? "El ecualizador necesita que abras el portfolio desde localhost"
    : "El audio funciona; el ecualizador requiere habilitar CORS en R2";
}

function applyEqualizer() {
  if (!equalizerFilters) return;
  equalizerFilters.bass.gain.value = equalizerState.bass;
  equalizerFilters.mid.gain.value = equalizerState.mid;
  equalizerFilters.treble.gain.value = equalizerState.treble;
}

function updateEqualizerControl(range, output, key) {
  equalizerState[key] = Number(range.value);
  output.value = `${equalizerState[key] > 0 ? "+" : ""}${equalizerState[key]} dB`;
  const progress = ((Number(range.value) - Number(range.min)) / (Number(range.max) - Number(range.min))) * 100;
  range.style.backgroundSize = `${progress}% 100%`;
  applyEqualizer();
}

function setEqualizerOpen(isOpen) {
  equalizerPanel.classList.toggle("is-open", isOpen);
  equalizerPanel.setAttribute("aria-hidden", String(!isOpen));
  equalizerPanel.inert = !isOpen;
  equalizerButton.setAttribute("aria-expanded", String(isOpen));
  equalizerButton.setAttribute("aria-label", isOpen ? "Cerrar ecualizador" : "Abrir ecualizador");
}

function setPlayerVisible(isVisible) {
  player.classList.toggle("is-visible", isVisible);
  player.setAttribute("aria-hidden", String(!isVisible));
  player.inert = !isVisible;
}

function scrollBehavior() {
  return reducedMotion.matches ? "auto" : "smooth";
}

function updateProjectScrollControl() {
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const isVisible = document.body.dataset.view !== "inicio" && window.innerWidth > 940 && maxScroll > 2;
  projectScrollControl.classList.toggle("is-visible", isVisible);
  if (!isVisible) return;

  const trackHeight = projectScrollControl.clientHeight;
  const thumbHeight = Math.max(58, trackHeight * Math.min(1, window.innerHeight / document.documentElement.scrollHeight));
  const available = Math.max(0, trackHeight - thumbHeight);
  const progress = maxScroll ? window.scrollY / maxScroll : 0;

  projectScrollThumb.style.height = `${thumbHeight}px`;
  projectScrollThumb.style.transform = `translateY(${available * progress}px)`;
  projectScrollControl.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
}

function requestProjectScrollUpdate() {
  if (projectScrollFrame) return;
  projectScrollFrame = window.requestAnimationFrame(() => {
    projectScrollFrame = 0;
    updateProjectScrollControl();
  });
}

function scrollProjectsFromPointer(clientY) {
  const track = projectScrollControl.getBoundingClientRect();
  const thumbHeight = projectScrollThumb.getBoundingClientRect().height;
  const available = Math.max(1, track.height - thumbHeight);
  const position = Math.max(0, Math.min(available, clientY - track.top - projectScrollDragOffset));
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo({ top: (position / available) * maxScroll, behavior: "auto" });
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function renderSongs() {
  const orderedSongs = state.sort === "title"
    ? [...songs].sort((a, b) => a.title.localeCompare(b.title, "es"))
    : [...songs];

  songGrid.innerHTML = orderedSongs.map((song, index) => {
    const isActive = state.currentSong?.id === song.id;
    const isPlaying = isActive && state.isPlaying;
    return `
      <article class="song-card${isActive ? " is-active" : ""}${isPlaying ? " is-playing" : ""}" data-song-id="${song.id}">
        <button class="cover-button" type="button" data-play="${song.id}" aria-label="${isPlaying ? "Pausar" : "Reproducir"} ${song.title}">
          <img class="cover-art" src="${encodeURI(song.cover)}" srcset="${encodeURI(song.cover)} 360w, ${encodeURI(song.coverLarge)} 720w" sizes="(max-width: 620px) calc((100vw - 42px) / 2), (max-width: 940px) calc((100vw - 68px) / 3), (max-width: 1280px) 18vw, 14vw" alt="Portada de ${song.title}" width="360" height="540" loading="lazy" decoding="async" fetchpriority="low">
          <span class="cover-fallback" aria-hidden="true">Portada no disponible</span>
          <span class="equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
          <span class="play-pill" aria-hidden="true">${isPlaying ? "Ⅱ" : "▶"}</span>
        </button>
        <div class="song-info">
          <h3 class="song-title">${song.title}</h3>
          <span class="song-number">${String(index + 1).padStart(2, "0")}</span>
        </div>
        <p class="song-artist">Rodriguez26Lucas</p>
      </article>
    `;
  }).join("");

}

songGrid.addEventListener("error", (event) => {
  if (!(event.target instanceof HTMLImageElement) || !event.target.classList.contains("cover-art")) return;
  event.target.closest(".cover-button")?.classList.add("has-image-error");
  event.target.hidden = true;
}, true);

function navigate(route, { historyMode = "replace", moveFocus = false } = {}) {
  const target = document.getElementById(route) || document.getElementById("inicio");
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("is-active", view === target));
  document.body.dataset.view = target.id;
  const archiveSidebar = document.querySelector("#archiveSidebar");
  const archiveLabels = {
    canciones: "N.º 26 · MÚSICA",
    proyectos: "N.º 26 · PRODUCTO",
    futuros: "N.º 26 · FUTURO",
    imagenes: "N.º 26 · IMÁGENES",
    videos: "N.º 26 · VIDEOS"
  };
  archiveSidebar?.setAttribute("data-section-label", archiveLabels[target.id] || "ARCHIVO PERSONAL");
  document.querySelectorAll("#archiveSidebar [data-route]").forEach((item) => {
    item.classList.toggle("is-current", item.dataset.route === target.id);
    if (item.dataset.route === target.id) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  if (target.id === "canciones" && !songGrid.childElementCount) renderSongs();

  const nextHash = `#${target.id}`;
  if (historyMode === "push" && location.hash !== nextHash) history.pushState(null, "", nextHash);
  if (historyMode === "replace" && location.hash !== nextHash) history.replaceState(null, "", nextHash);

  window.scrollTo({ top: 0, behavior: historyMode === "push" ? scrollBehavior() : "auto" });
  document.title = target.id === "inicio"
    ? "CREADOR100K — Archivo personal"
    : `${target.querySelector("h2")?.textContent?.trim() || "Archivo"} — CREADOR100K`;

  if (moveFocus) {
    const heading = target.querySelector("h1, h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      window.requestAnimationFrame(() => heading.focus({ preventScroll: true }));
    }
  }

  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    requestProjectScrollUpdate();
  }));
}

async function selectSong(songId, shouldPlay = true) {
  const selected = songs.find((song) => song.id === songId);
  if (!selected) return;

  if (state.currentSong?.id !== selected.id) {
    state.currentSong = selected;
    state.currentTime = 0;
    audio.src = encodeURI(selected.audio);
    audio.load();
  }

  setPlayerVisible(true);
  if (shouldPlay) await playAudio();
  else pauseAudio();
  updatePlayer();
  renderSongs();
}

async function playAudio() {
  if (!state.currentSong) return;
  setPlayerVisible(true);
  try {
    if (audioContext?.state === "suspended") await audioContext.resume();
    await audio.play();
    state.isPlaying = true;
    return;
  } catch {
    if (audio.crossOrigin === "anonymous") {
      const blockedAudio = audio;
      blockedAudio.pause();
      clearTimeout(equalizerSignalCheck);
      try { audioSource?.disconnect(); } catch {}
      try { if (audioContext && audioContext.state !== "closed") await audioContext.close(); } catch {}
      audioContext = undefined;
      audioSource = undefined;
      equalizerFilters = undefined;
      equalizerAnalyser = undefined;
      equalizerUnavailable = true;

      audio = new Audio();
      audio.preload = "metadata";
      audio.volume = state.volume;
      bindAudioEvents(audio);
      audio.src = encodeURI(state.currentSong.audio);
      audio.load();

      try {
        await audio.play();
        state.isPlaying = true;
        showToast("Reproduciendo sin ecualizador: falta habilitar CORS en R2");
        return;
      } catch {}
    }

    state.isPlaying = false;
    showToast("No se pudo reproducir este archivo");
  }
}

function pauseAudio() {
  audio.pause();
  state.isPlaying = false;
}

function togglePlayerMinimized() {
  const isMinimized = player.classList.toggle("is-minimized");
  const action = isMinimized ? "Expandir reproductor" : "Minimizar reproductor";
  minimizePlayerButton.setAttribute("aria-label", action);
  minimizePlayerButton.title = action;
}
function closePlayer() {
  pauseAudio();
  player.classList.remove("is-minimized");
  setEqualizerOpen(false);
  setPlayerVisible(false);
  minimizePlayerButton.setAttribute("aria-label", "Minimizar reproductor");
  minimizePlayerButton.title = "Minimizar reproductor";
  renderSongs();
}

async function togglePlayback() {
  if (!state.currentSong) {
    await selectSong(songs[0].id, true);
    return;
  }
  if (state.isPlaying) pauseAudio();
  else await playAudio();
  updatePlayer();
  renderSongs();
}

function playAdjacent(direction) {
  if (!state.currentSong) {
    selectSong(songs[0].id, true);
    return;
  }
  let nextIndex;
  if (state.shuffle) {
    nextIndex = Math.floor(Math.random() * songs.length);
  } else {
    const currentIndex = songs.findIndex((song) => song.id === state.currentSong.id);
    nextIndex = (currentIndex + direction + songs.length) % songs.length;
  }
  selectSong(songs[nextIndex].id, true);
}

function updatePlayer() {
  if (!state.currentSong) return;
  document.querySelector("#playerTitle").textContent = state.currentSong.title;
  document.querySelector("#miniCover").style.backgroundImage = `url("${encodeURI(state.currentSong.cover)}")`;
  mainPlayButton.classList.toggle("is-playing", state.isPlaying);
  mainPlayButton.setAttribute("aria-label", state.isPlaying ? "Pausar" : "Reproducir");
  document.querySelector("#repeatButton").classList.toggle("is-active", state.repeat);
  document.querySelector("#shuffleButton").classList.toggle("is-active", state.shuffle);
  document.querySelector("#repeatButton").setAttribute("aria-pressed", String(state.repeat));
  document.querySelector("#shuffleButton").setAttribute("aria-pressed", String(state.shuffle));
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  progressRange.max = duration || 1;
  durationTimeLabel.textContent = duration ? formatTime(duration) : "0:00";
  updateProgress();
}

function updateProgress() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  state.currentTime = audio.currentTime || 0;
  progressRange.value = state.currentTime;
  currentTimeLabel.textContent = formatTime(state.currentTime);
  const percent = duration ? (state.currentTime / duration) * 100 : 0;
  progressRange.style.backgroundSize = `${percent}% 100%`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function bindAudioEvents(element) {
  element.addEventListener("loadedmetadata", updatePlayer);
  element.addEventListener("timeupdate", updateProgress);
  element.addEventListener("play", () => {
    if (element !== audio) return;
    state.isPlaying = true;
    scheduleEqualizerSignalCheck();
    updatePlayer();
    renderSongs();
  });
  element.addEventListener("pause", () => {
    if (element !== audio) return;
    state.isPlaying = false;
    updatePlayer();
    renderSongs();
  });
  element.addEventListener("ended", () => {
    if (element !== audio) return;
    if (state.repeat) {
      audio.currentTime = 0;
      playAudio();
    } else {
      playAdjacent(1);
    }
  });
  element.addEventListener("error", () => {
    if (element !== audio || !state.currentSong) return;
    state.isPlaying = false;
    updatePlayer();
    renderSongs();
    showToast("No se pudo cargar esta canción");
  });
}

bindAudioEvents(audio);

document.addEventListener("click", (event) => {
  const routeTarget = event.target.closest("[data-route]");
  if (routeTarget) {
    event.preventDefault();
    navigate(routeTarget.dataset.route, { historyMode: "push", moveFocus: true });
    return;
  }

  const playTarget = event.target.closest("[data-play]");
  if (playTarget) {
    const songId = Number(playTarget.dataset.play);
    if (state.currentSong?.id === songId) togglePlayback();
    else selectSong(songId, true);
  }
});

document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    state.sort = button.dataset.sort;
    document.querySelectorAll("[data-sort]").forEach((item) => {
      const isActive = item === button;
      item.classList.toggle("is-active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });
    renderSongs();
  });
});

minimizePlayerButton.addEventListener("click", togglePlayerMinimized);
closePlayerButton.addEventListener("click", closePlayer);
mainPlayButton.addEventListener("click", togglePlayback);
document.querySelector("#prevButton").addEventListener("click", () => playAdjacent(-1));
document.querySelector("#nextButton").addEventListener("click", () => playAdjacent(1));

document.querySelector("#repeatButton").addEventListener("click", () => {
  state.repeat = !state.repeat;
  audio.loop = state.repeat;
  updatePlayer();
});

document.querySelector("#shuffleButton").addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  updatePlayer();
});

progressRange.addEventListener("input", () => {
  audio.currentTime = Number(progressRange.value);
  updateProgress();
});

volumeRange.addEventListener("input", () => {
  state.volume = Number(volumeRange.value);
  audio.volume = state.volume;
  volumeRange.style.backgroundSize = `${state.volume * 100}% 100%`;
});

[equalizerButton, equalizerPanel].forEach((element) => {
  element.addEventListener("click", (event) => event.stopPropagation());
});

equalizerButton.addEventListener("click", () => {
  if (equalizerUnavailable) {
    setEqualizerOpen(false);
    showToast(equalizerUnavailableMessage());
    return;
  }
  const willOpen = !equalizerPanel.classList.contains("is-open");
  setEqualizerOpen(willOpen);
});

[[bassRange, document.querySelector("#bassValue"), "bass"], [midRange, document.querySelector("#midValue"), "mid"], [trebleRange, document.querySelector("#trebleValue"), "treble"]].forEach(([range, output, key]) => {
  updateEqualizerControl(range, output, key);
  range.addEventListener("pointerdown", async () => {
    if (!state.currentSong || equalizerFilters) return;
    const isReady = await ensureAudioGraph();
    if (!isReady) showToast(equalizerUnavailableMessage());
  });
  range.addEventListener("input", async () => {
    if (!equalizerFilters) {
      const isReady = await ensureAudioGraph();
      if (!isReady) {
        range.value = String(DEFAULT_EQUALIZER[key]);
        showToast(equalizerUnavailableMessage());
      }
    }
    updateEqualizerControl(range, output, key);
    scheduleEqualizerSignalCheck();
  });
});

equalizerReset.addEventListener("click", resetEqualizerControls);

document.addEventListener("click", () => setEqualizerOpen(false));

projectScrollControl.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const thumbRect = projectScrollThumb.getBoundingClientRect();
  projectScrollDragOffset = event.target === projectScrollThumb ? event.clientY - thumbRect.top : thumbRect.height / 2;
  projectScrollControl.setPointerCapture(event.pointerId);
  projectScrollControl.classList.add("is-dragging");
  scrollProjectsFromPointer(event.clientY);
});

projectScrollControl.addEventListener("pointermove", (event) => {
  if (projectScrollDragOffset === null) return;
  scrollProjectsFromPointer(event.clientY);
});

projectScrollControl.addEventListener("pointerup", (event) => {
  projectScrollDragOffset = null;
  projectScrollControl.classList.remove("is-dragging");
  projectScrollControl.releasePointerCapture(event.pointerId);
});

projectScrollControl.addEventListener("keydown", (event) => {
  const actions = {
    ArrowDown: () => window.scrollBy({ top: 140, behavior: scrollBehavior() }),
    ArrowUp: () => window.scrollBy({ top: -140, behavior: scrollBehavior() }),
    PageDown: () => window.scrollBy({ top: window.innerHeight * 0.8, behavior: scrollBehavior() }),
    PageUp: () => window.scrollBy({ top: -window.innerHeight * 0.8, behavior: scrollBehavior() }),
    Home: () => window.scrollTo({ top: 0, behavior: scrollBehavior() }),
    End: () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: scrollBehavior() })
  };
  if (!actions[event.key]) return;
  event.preventDefault();
  actions[event.key]();
});

window.addEventListener("scroll", requestProjectScrollUpdate, { passive: true });
window.addEventListener("resize", requestProjectScrollUpdate);
window.addEventListener("load", requestProjectScrollUpdate);

document.querySelector("#shareButton").addEventListener("click", async () => {
  if (!state.currentSong) return;
  const shareData = {
    title: state.currentSong.title,
    text: `Escuchá “${state.currentSong.title}” de Rodriguez26Lucas`,
    url: `${location.href.split("#")[0]}#canciones`
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(`${shareData.text} — ${shareData.url}`);
      showToast("Enlace copiado");
    }
  } catch (error) {
    if (error.name !== "AbortError") showToast("No se pudo compartir");
  }
});

window.addEventListener("popstate", () => navigate(location.hash.slice(1) || "inicio", { historyMode: "none", moveFocus: false }));
window.addEventListener("keydown", (event) => {
  const activeElement = document.activeElement;
  const isInteractive = activeElement?.closest?.("button, a, input, textarea, select, [contenteditable='true']");
  if (event.code === "Space" && state.currentSong && !isInteractive) {
    event.preventDefault();
    togglePlayback();
  }
  if (event.key === "Escape") {
    setEqualizerOpen(false);
  }
});

navigate(location.hash.slice(1) || "inicio", { historyMode: "replace" });
