const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");

function startServer() {
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = path.resolve(root, relativePath);

    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, "index.html")) {
      response.writeHead(403).end();
      return;
    }

    fs.readFile(filePath, (error, contents) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }

      const contentType = filePath.endsWith(".js")
        ? "text/javascript"
        : filePath.endsWith(".css")
          ? "text/css"
          : "text/html";
      response.writeHead(200, { "Content-Type": contentType });
      response.end(contents);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    chromium.executablePath(),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function collectToastMessages(page) {
  await page.evaluate(() => {
    window.__tvPlaybackMessages = [];
    const toast = document.querySelector("#toast");
    new MutationObserver(() => {
      const message = toast.textContent.trim();
      if (message) window.__tvPlaybackMessages.push(message);
    }).observe(toast, { childList: true, subtree: true, characterData: true });
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const executablePath = findBrowserExecutable();
  assert.ok(executablePath, "A Chromium or Edge executable is required for this test");
  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.addInitScript(({ defaults }) => {
      window.__equalizerFilters = [];
      window.__audioContextConstructorArguments = [];
      window.__playingMedia = new WeakSet();
      window.__mediaSources = new WeakMap();

      class TestAudioContext {
        constructor(...args) {
          window.__audioContextConstructorArguments.push(args.length);
          if (args.length) throw new TypeError("Legacy Tizen AudioContext does not accept constructor options");
          this.state = "running";
          this.destination = {};
        }

        createMediaElementSource() {
          return {
            connect(next) { return next; },
            disconnect() {}
          };
        }

        createBiquadFilter() {
          if (location.search.includes("failGraphAfterSource=1")) {
            throw new DOMException("Legacy filter construction failed", "NotSupportedError");
          }
          const filter = {
            connect(next) { return next; },
            disconnect() {},
            gain: { value: 0 },
            frequency: { value: 0 },
            Q: { value: 0 }
          };
          window.__equalizerFilters.push(filter);
          return filter;
        }

        createAnalyser() {
          let reads = 0;
          return {
            fftSize: 512,
            connect(next) { return next; },
            disconnect() {},
            getByteTimeDomainData(samples) {
              reads += 1;
              const isQuietIntro = location.search.includes("quietIntro=1") && reads < 3;
              samples.fill(isQuietIntro ? 128 : 131);
            }
          };
        }

        createGain() {
          return {
            gain: { value: 1 },
            connect(next) { return next; },
            disconnect() {}
          };
        }

        async resume() { this.state = "running"; }
        async close() { this.state = "closed"; }
      }

      Object.defineProperty(window, "AudioContext", { configurable: true, value: TestAudioContext });
      Object.defineProperty(HTMLMediaElement.prototype, "src", {
        configurable: true,
        get() { return window.__mediaSources.get(this) || ""; },
        set(value) { window.__mediaSources.set(this, String(value)); }
      });
      Object.defineProperty(HTMLMediaElement.prototype, "currentSrc", {
        configurable: true,
        get() { return window.__mediaSources.get(this) || ""; }
      });
      Object.defineProperty(HTMLMediaElement.prototype, "paused", {
        configurable: true,
        get() { return !window.__playingMedia.has(this); }
      });
      HTMLMediaElement.prototype.load = function load() {};
      HTMLMediaElement.prototype.play = function play() {
        if (location.search.includes("forceAudioFallback=1") && this.crossOrigin === "anonymous") {
          this.dispatchEvent(new Event("error"));
          return Promise.reject(new DOMException("Cross-origin media playback failed", "NotSupportedError"));
        }
        window.__playingMedia.add(this);
        this.dispatchEvent(new Event("play"));
        if (location.search.includes("asyncAudioError=1") && this.crossOrigin === "anonymous") {
          setTimeout(() => this.dispatchEvent(new Event("error")), 20);
          return undefined;
        }
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function pause() {
        window.__playingMedia.delete(this);
        this.dispatchEvent(new Event("pause"));
      };
      window.__expectedEqualizerDefaults = defaults;
    }, { defaults: [5, 3, 1] });

    await page.goto(`http://127.0.0.1:${port}/?tv=1#canciones`, { waitUntil: "domcontentloaded", timeout: 5000 });
    await page.waitForFunction(() => typeof selectSong === "function");
    await collectToastMessages(page);
    await page.evaluate(() => selectSong(1, true));
    await page.waitForFunction(
      () => document.querySelector("#equalizerButton").dataset.equalizerStatus === "active",
      null,
      { timeout: 3000 }
    );

    const result = await page.evaluate(() => ({
      gains: window.__equalizerFilters.map((filter) => filter.gain.value),
      expected: window.__expectedEqualizerDefaults,
      constructorArguments: window.__audioContextConstructorArguments,
      playbackMessages: window.__tvPlaybackMessages,
      buttonHidden: document.querySelector("#equalizerButton").hidden,
      buttonDisabled: document.querySelector("#equalizerButton").disabled,
      buttonStatus: document.querySelector("#equalizerButton").dataset.equalizerStatus,
      buttonRendered: document.querySelector("#equalizerButton").getBoundingClientRect().width > 0
        && getComputedStyle(document.querySelector("#equalizerButton")).display !== "none",
      panelHidden: document.querySelector("#equalizerPanel").hidden,
      rangesDisabled: [...document.querySelectorAll("#equalizerPanel input[type='range']")]
        .every((range) => range.disabled)
    }));
    assert.deepEqual(
      result.gains,
      result.expected,
      "TV playback must build the audio graph and apply the default equalizer gains"
    );
    assert.deepEqual(result.constructorArguments, [0], "TV must use the legacy-compatible AudioContext constructor");
    assert.deepEqual(result.playbackMessages, [], "TV playback must not show contradictory error or fallback messages");
    assert.equal(result.buttonHidden, false, "TV must show the equalizer status icon");
    assert.equal(result.buttonRendered, true, "TV equalizer status icon must be visible in the player layout");
    assert.equal(result.buttonDisabled, true, "TV equalizer icon must not open editable settings");
    assert.equal(result.buttonStatus, "active", "TV equalizer icon must confirm that processing is active");
    assert.equal(result.panelHidden, true, "TV must not expose the equalizer panel");
    assert.equal(result.rangesDisabled, true, "TV equalizer settings must not be editable");
    if (process.env.TV_EQ_SCREENSHOT) {
      await page.screenshot({ path: process.env.TV_EQ_SCREENSHOT, fullPage: false });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    const compactLayout = await page.evaluate(() => {
      const iconRect = document.querySelector("#equalizerButton").getBoundingClientRect();
      return {
        rendered: iconRect.width > 0 && getComputedStyle(document.querySelector("#equalizerButton")).display !== "none",
        insideViewport: iconRect.left >= 0 && iconRect.right <= innerWidth && iconRect.top >= 0 && iconRect.bottom <= innerHeight
      };
    });
    assert.equal(compactLayout.rendered, true, "Compact TV layout must keep the equalizer icon visible");
    assert.equal(compactLayout.insideViewport, true, "Compact TV layout must keep the equalizer icon on screen");
    if (process.env.TV_EQ_COMPACT_SCREENSHOT) {
      await page.screenshot({ path: process.env.TV_EQ_COMPACT_SCREENSHOT, fullPage: false });
    }
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(`http://127.0.0.1:${port}/?tv=1&quietIntro=1#canciones`, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });
    await page.waitForFunction(() => typeof selectSong === "function");
    await collectToastMessages(page);
    await page.evaluate(() => selectSong(1, true));
    await page.waitForFunction(
      () => document.querySelector("#equalizerButton").dataset.equalizerStatus === "active",
      null,
      { timeout: 5000 }
    );
    const quietIntroResult = await page.evaluate(() => ({
      playbackMessages: window.__tvPlaybackMessages,
      stillUsingCorsAudio: audio.crossOrigin === "anonymous"
    }));
    assert.deepEqual(quietIntroResult.playbackMessages, [], "Quiet intro must not trigger an equalizer fallback message");
    assert.equal(quietIntroResult.stillUsingCorsAudio, true, "Quiet intro must keep the equalized media element");

    await page.goto(`http://127.0.0.1:${port}/?tv=1&forceAudioFallback=1#canciones`, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });
    await page.waitForFunction(() => typeof selectSong === "function");
    await collectToastMessages(page);
    await page.evaluate(() => selectSong(1, true));
    const fallbackResult = await page.evaluate(() => ({
      playbackMessages: window.__tvPlaybackMessages,
      buttonStatus: document.querySelector("#equalizerButton").dataset.equalizerStatus,
      isPlaying: state.isPlaying
    }));
    assert.deepEqual(fallbackResult.playbackMessages, [], "TV fallback must not show contradictory error messages");
    assert.equal(fallbackResult.buttonStatus, "unavailable", "TV icon must report when equalization is unavailable");
    assert.equal(fallbackResult.isPlaying, true, "TV fallback must keep playback running");

    await page.goto(`http://127.0.0.1:${port}/?tv=1&asyncAudioError=1#canciones`, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });
    await page.waitForFunction(() => typeof selectSong === "function");
    await collectToastMessages(page);
    await page.evaluate(() => selectSong(1, true));
    await page.waitForFunction(() => audio.crossOrigin !== "anonymous" && state.isPlaying, null, { timeout: 2500 });
    const asyncErrorResult = await page.evaluate(() => ({
      playbackMessages: window.__tvPlaybackMessages,
      buttonStatus: document.querySelector("#equalizerButton").dataset.equalizerStatus
    }));
    assert.deepEqual(asyncErrorResult.playbackMessages, [], "Legacy asynchronous media error must recover without duplicate messages");
    assert.equal(asyncErrorResult.buttonStatus, "unavailable", "Async fallback must update the equalizer icon");

    await page.goto(`http://127.0.0.1:${port}/?tv=1&asyncAudioError=1#canciones`, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });
    await page.waitForFunction(() => typeof selectSong === "function");
    await page.evaluate(() => selectSong(1, true));
    await page.waitForTimeout(100);
    await page.evaluate(() => pauseAudio());
    await page.waitForTimeout(900);
    const pausedRecoveryResult = await page.evaluate(() => ({
      isPlaying: state.isPlaying,
      paused: audio.paused
    }));
    assert.equal(pausedRecoveryResult.isPlaying, false, "Fallback must respect a pause requested during recovery");
    assert.equal(pausedRecoveryResult.paused, true, "Fallback must not restart hidden audio after pause");

    await page.goto(`http://127.0.0.1:${port}/?tv=1&failGraphAfterSource=1#canciones`, {
      waitUntil: "domcontentloaded",
      timeout: 5000
    });
    await page.waitForFunction(() => typeof selectSong === "function");
    await collectToastMessages(page);
    await page.evaluate(() => selectSong(1, true));
    const graphFailureResult = await page.evaluate(() => ({
      playbackMessages: window.__tvPlaybackMessages,
      buttonStatus: document.querySelector("#equalizerButton").dataset.equalizerStatus,
      usingNativeAudio: audio.crossOrigin !== "anonymous",
      isPlaying: state.isPlaying
    }));
    assert.deepEqual(graphFailureResult.playbackMessages, [], "Graph failure must recover without contradictory messages");
    assert.equal(graphFailureResult.buttonStatus, "unavailable", "Graph failure must update the equalizer icon");
    assert.equal(graphFailureResult.usingNativeAudio, true, "Graph failure must replace the bound media element");
    assert.equal(graphFailureResult.isPlaying, true, "Graph failure fallback must keep playback running");
    const repeatedNativePlayback = await page.evaluate(async () => {
      const nativeAudio = audio;
      pauseAudio();
      await playAudio();
      return { sameElement: audio === nativeAudio, isPlaying: state.isPlaying };
    });
    assert.equal(repeatedNativePlayback.sameElement, true, "Later native playback must reuse the recovered audio element");
    assert.equal(repeatedNativePlayback.isPlaying, true, "Later native playback must start without another recovery delay");

    await page.goto(`http://127.0.0.1:${port}/?tv=0#canciones`, { waitUntil: "domcontentloaded", timeout: 5000 });
    await page.evaluate(() => document.querySelector("#equalizerButton").click());
    const desktopResult = await page.evaluate(() => ({
      buttonDisabled: document.querySelector("#equalizerButton").disabled,
      panelOpen: document.querySelector("#equalizerPanel").classList.contains("is-open"),
      rangesEnabled: [...document.querySelectorAll("#equalizerPanel input[type='range']")]
        .every((range) => !range.disabled)
    }));
    assert.equal(desktopResult.buttonDisabled, false, "Desktop equalizer button must remain editable");
    assert.equal(desktopResult.panelOpen, true, "Desktop equalizer panel must still open");
    assert.equal(desktopResult.rangesEnabled, true, "Desktop equalizer ranges must remain enabled");
    console.log("PASS: legacy TV applies the default equalizer and shows a non-editable active icon");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
