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
    const page = await browser.newPage();
    await page.addInitScript(({ defaults }) => {
      window.__equalizerFilters = [];

      class TestAudioContext {
        constructor() {
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
          return {
            fftSize: 512,
            connect(next) { return next; },
            disconnect() {},
            getByteTimeDomainData(samples) { samples.fill(129); }
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
      HTMLMediaElement.prototype.load = function load() {};
      HTMLMediaElement.prototype.play = async function play() {
        this.dispatchEvent(new Event("play"));
      };
      HTMLMediaElement.prototype.pause = function pause() {
        this.dispatchEvent(new Event("pause"));
      };
      window.__expectedEqualizerDefaults = defaults;
    }, { defaults: [5, 3, 1] });

    await page.goto(`http://127.0.0.1:${port}/?tv=1#canciones`, { waitUntil: "domcontentloaded", timeout: 5000 });
    await page.waitForFunction(() => typeof selectSong === "function");
    await page.evaluate(() => selectSong(1, true));

    const result = await page.evaluate(() => ({
      gains: window.__equalizerFilters.map((filter) => filter.gain.value),
      expected: window.__expectedEqualizerDefaults,
      buttonHidden: document.querySelector("#equalizerButton").hidden,
      panelHidden: document.querySelector("#equalizerPanel").hidden,
      rangesDisabled: [...document.querySelectorAll("#equalizerPanel input[type='range']")]
        .every((range) => range.disabled)
    }));

    assert.deepEqual(
      result.gains,
      result.expected,
      "TV playback must build the audio graph and apply the default equalizer gains"
    );
    assert.equal(result.buttonHidden, true, "TV must not expose the equalizer button");
    assert.equal(result.panelHidden, true, "TV must not expose the equalizer panel");
    assert.equal(result.rangesDisabled, true, "TV equalizer settings must not be editable");
    console.log("PASS: TV applies the default equalizer without exposing editable controls");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
