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
    dom.sessionExistsButton = document.getElementById("sessionExistsButton");
    dom.callExistsButton = document.getElementById("callExistsButton");
    dom.sessionButton = document.getElementById("sessionButton");
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

    dom.sessionExistsButton.addEventListener("click", function () {
      runTest("getSession-exists", testGetSessionExists);
    });

    dom.callExistsButton.addEventListener("click", function () {
      runTest("api-call-exists", testApiCallExists);
    });

    dom.sessionButton.addEventListener("click", function () {
      runTest("invoke-getSession", testGetSession);
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

  async function testGetSession() {
    return await invokeApiGetSession();
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

  async function testGetSessionExists() {
    return {
      apiExists: Boolean(apiRef),
      getSessionType: apiRef ? typeof apiRef.getSession : "missing",
      getSessionPresent: Boolean(apiRef && apiRef.getSession)
    };
  }

  async function testApiCallExists() {
    return {
      apiExists: Boolean(apiRef),
      callType: apiRef ? typeof apiRef.call : "missing",
      callPresent: Boolean(apiRef && apiRef.call)
    };
  }

  function invokeApiGetSession() {
    return new Promise(function (resolve, reject) {
      if (!apiRef || typeof apiRef.getSession !== "function") {
        reject(new Error("api.getSession() is unavailable."));
        return;
      }

      try {
        var result = apiRef.getSession(function (value) {
          resolve(value);
        }, function (error) {
          reject(error);
        });

        if (result && typeof result.then === "function") {
          result.then(resolve).catch(reject);
        }
      } catch (error) {
        reject(error);
      }
    });
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
