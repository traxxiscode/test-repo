(function () {
  var apiRef = null;
  var stateRef = null;
  var dom = {};
  var isReady = false;

  function cacheDom() {
    dom.statusMessage = document.getElementById("statusMessage");
    dom.outputBox = document.getElementById("outputBox");
    dom.loadBadge = document.getElementById("loadBadge");
    dom.pingButton = document.getElementById("pingButton");
    dom.snapshotButton = document.getElementById("snapshotButton");
    dom.apiPropsButton = document.getElementById("apiPropsButton");
    dom.statePropsButton = document.getElementById("statePropsButton");
    dom.browserPropsButton = document.getElementById("browserPropsButton");
    dom.staticFetchButton = document.getElementById("staticFetchButton");
    dom.functionFetchButton = document.getElementById("functionFetchButton");
    dom.deviceStateButton = document.getElementById("deviceStateButton");
    dom.devicePostButton = document.getElementById("devicePostButton");
  }

  function bindEvents() {
    dom.pingButton.addEventListener("click", function () {
      setStatus("Plain button click succeeded.", false);
      writeOutput({
        action: "plain-click",
        ok: true,
        timestamp: new Date().toISOString()
      });
    });

    dom.snapshotButton.addEventListener("click", function () {
      runTest("api-state-snapshot", testApiStateSnapshot);
    });

    dom.apiPropsButton.addEventListener("click", function () {
      runTest("api-properties", testApiProperties);
    });

    dom.statePropsButton.addEventListener("click", function () {
      runTest("state-properties", testStateProperties);
    });

    dom.browserPropsButton.addEventListener("click", function () {
      runTest("browser-context", testBrowserContext);
    });

    dom.staticFetchButton.addEventListener("click", function () {
      runTest("fetch-static-asset", testStaticFetch);
    });

    dom.functionFetchButton.addEventListener("click", function () {
      runTest("fetch-function-route", testFunctionFetch);
    });

    dom.deviceStateButton.addEventListener("click", function () {
      runTest("inspect-state-device", testStateDevice);
    });

    dom.devicePostButton.addEventListener("click", function () {
      runTest("post-state-device-id", testDevicePost);
    });
  }

  function prepareUi() {
    if (isReady) {
      return;
    }

    cacheDom();
    bindEvents();
    isReady = true;
  }

  function whenDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }

    callback();
  }

  async function runTest(label, handler) {
    setStatus("Running " + label + "...", false);

    try {
      var result = await handler();
      setStatus(label + " succeeded.", false);
      writeOutput({
        action: label,
        ok: true,
        result: result
      });
    } catch (error) {
      setStatus(label + " failed: " + readableError(error, "Unknown error"), true);
      writeOutput({
        action: label,
        ok: false,
        error: readableError(error, "Unknown error")
      });
    }
  }

  async function testApiStateSnapshot() {
    return {
      apiExists: Boolean(apiRef),
      stateExists: Boolean(stateRef),
      apiUserName: apiRef && (apiRef.userName || apiRef.UserName || null),
      apiDatabase: apiRef && (apiRef.database || apiRef.Database || null),
      apiServer: apiRef && (apiRef.server || apiRef.Server || null),
      stateKeys: stateRef ? Object.keys(stateRef).sort() : [],
      apiKeysSample: apiRef ? Object.keys(apiRef).sort().slice(0, 25) : []
    };
  }

  async function testApiProperties() {
    return {
      apiExists: Boolean(apiRef),
      userName: apiRef && (apiRef.userName || apiRef.UserName || null),
      database: apiRef && (apiRef.database || apiRef.Database || null),
      server: apiRef && (apiRef.server || apiRef.Server || null),
      baseUrl: apiRef && (apiRef.baseUrl || apiRef.BaseUrl || null),
      credentials: apiRef && {
        userName: apiRef.userName || apiRef.UserName || null,
        database: apiRef.database || apiRef.Database || null,
        server: apiRef.server || apiRef.Server || null
      }
    };
  }

  async function testStateProperties() {
    return {
      stateExists: Boolean(stateRef),
      stateKeys: stateRef ? Object.keys(stateRef).sort() : [],
      stateSnapshot: sanitizeForOutput(stateRef)
    };
  }

  async function testBrowserContext() {
    return {
      locationHref: window.location.href,
      locationSearch: window.location.search,
      locationHash: window.location.hash,
      referrer: document.referrer || "",
      title: document.title,
      userAgent: navigator.userAgent
    };
  }

  async function testStaticFetch() {
    var response = await fetch("addin.css", {
      method: "GET",
      cache: "no-store"
    });
    var text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 160)
    };
  }

  async function testFunctionFetch() {
    var response = await fetch("/.netlify/functions/ping", {
      method: "GET",
      cache: "no-store"
    });
    var text = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 160)
    };
  }

  async function testStateDevice() {
    var device = stateRef && stateRef.device ? stateRef.device : null;

    return {
      hasDevice: Boolean(device),
      deviceId: device && (device.id || device.Id || null),
      deviceName: device && (device.name || device.Name || null),
      deviceKeys: device ? Object.keys(device).sort() : [],
      deviceSnapshot: sanitizeForOutput(device)
    };
  }

  async function testDevicePost() {
    var device = stateRef && stateRef.device ? stateRef.device : null;
    var deviceId = device && (device.id || device.Id || null);

    if (!deviceId) {
      throw new Error("state.device.id is unavailable.");
    }

    var response = await fetch("/.netlify/functions/transport-start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: "TEST-DEVICE",
        purpose: "Dialysis",
        specialEquipment: "Wheelchair",
        startedAt: new Date().toISOString(),
        vehicle: {
          key: String(deviceId),
          name: device.name || device.Name || "Unknown device"
        },
        geotab: {
          database: "",
          domain: ""
        }
      })
    });
    var text = await response.text();

    return {
      deviceId: String(deviceId),
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyPreview: text.slice(0, 300)
    };
  }

  function setStatus(message, isError) {
    if (!dom.statusMessage) {
      return;
    }

    dom.statusMessage.textContent = message;
    dom.statusMessage.className = isError ? "statusMessage isError" : "statusMessage";
  }

  function writeOutput(value) {
    if (!dom.outputBox) {
      return;
    }

    dom.outputBox.textContent = JSON.stringify(value, null, 2);
  }

  function readableError(error, fallback) {
    if (!error) {
      return fallback;
    }

    if (typeof error === "string") {
      return error;
    }

    return error.message || fallback;
  }

  function sanitizeForOutput(value) {
    try {
      return JSON.parse(JSON.stringify(value || {}));
    } catch (error) {
      return {
        note: "State could not be serialized directly.",
        keys: value ? Object.keys(value).sort() : []
      };
    }
  }

  function registerAddIn() {
    window.geotab.addin.drive = function () {
      return {
        initialize: function (api, state, callback) {
          apiRef = api;
          stateRef = state;
          whenDomReady(function () {
            prepareUi();
            setStatus("Drive harness initialized.", false);
            if (dom.loadBadge) {
              dom.loadBadge.textContent = "Initialized";
            }
          });

          if (typeof callback === "function") {
            callback();
          }
        },
        focus: function (api, state) {
          apiRef = api || apiRef;
          stateRef = state || stateRef;
          whenDomReady(function () {
            prepareUi();
          });
        },
        blur: function () {
          return;
        }
      };
    };
  }

  if (window.geotab && window.geotab.addin) {
    registerAddIn();
  } else {
    whenDomReady(function () {
      prepareUi();
      setStatus("Standalone browser mode active.", false);
      if (dom.loadBadge) {
        dom.loadBadge.textContent = "Browser";
      }
    });
  }
})();
