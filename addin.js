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
    dom.sessionButton = document.getElementById("sessionButton");
    dom.userButton = document.getElementById("userButton");
    dom.deviceStatusButton = document.getElementById("deviceStatusButton");
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

    dom.sessionButton.addEventListener("click", function () {
      runTest("getSession", testGetSession);
    });

    dom.userButton.addEventListener("click", function () {
      runTest("user-lookup", testUserLookup);
    });

    dom.deviceStatusButton.addEventListener("click", function () {
      runTest("device-status-info", testDeviceStatusInfo);
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

  async function testUserLookup() {
    var session = await invokeApiGetSession();
    var userName = session.userName || session.UserName;
    var users = await geotabGet("User", { name: userName }, 1);
    return {
      sessionUserName: userName,
      users: users
    };
  }

  async function testDeviceStatusInfo() {
    var session = await invokeApiGetSession();
    var userName = session.userName || session.UserName;
    var users = await geotabGet("User", { name: userName }, 1);

    if (!users.length) {
      throw new Error("No matching user was returned.");
    }

    var userId = users[0].id || users[0].Id;
    var statuses = await geotabGet("DeviceStatusInfo", {
      userSearch: {
        id: stringifyId(userId)
      }
    }, 1);

    return {
      sessionUserName: userName,
      resolvedUserId: stringifyId(userId),
      statuses: statuses
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

  function geotabGet(typeName, search, resultsLimit) {
    return new Promise(function (resolve, reject) {
      if (!apiRef || typeof apiRef.call !== "function") {
        reject(new Error("api.call() is unavailable."));
        return;
      }

      apiRef.call("Get", {
        typeName: typeName,
        search: search,
        resultsLimit: resultsLimit || 1
      }, function (result) {
        resolve(Array.isArray(result) ? result : []);
      }, reject);
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

  function stringifyId(value) {
    if (!value) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (value.id) {
      return value.id;
    }

    return String(value);
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
