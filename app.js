document.addEventListener("DOMContentLoaded", function () {
  // Demo login
  const form = document.getElementById("demoLogin");

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const roleElement = document.getElementById("role");
      const role = roleElement ? roleElement.value : "retailer";

      localStorage.setItem("rczoneDemoRole", role);
      window.location.href = "dashboard.html";
    });
  }

  // Demo retailer management
  const retailerForm = document.getElementById("retailerForm");
  const retailerName = document.getElementById("retailerName");
  const retailerCode = document.getElementById("retailerCode");
  const retailerList = document.getElementById("retailerList");

  if (retailerForm && retailerName && retailerCode && retailerList) {
    function renderRetailers() {
      const retailers = JSON.parse(
        localStorage.getItem("rczoneDemoRetailers") || "[]"
      );

      retailerList.innerHTML = "";

      if (retailers.length === 0) {
        retailerList.textContent = "No demo retailers added.";
        retailerList.className = "empty-state";
        return;
      }

      retailerList.className = "";
      retailers.forEach(function (retailer) {
        const item = document.createElement("div");
        item.className = "notice";
        item.textContent =
          retailer.name + " — " + retailer.code;
        retailerList.appendChild(item);
      });
    }

    retailerForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const name = retailerName.value.trim();
      const code = retailerCode.value.trim();

      if (!name || !code) {
        alert("Retailer name aur code dono bharein.");
        return;
      }

      const retailers = JSON.parse(
        localStorage.getItem("rczoneDemoRetailers") || "[]"
      );

      if (
        retailers.some(function (retailer) {
          return retailer.code.toLowerCase() === code.toLowerCase();
        })
      ) {
        alert("Yeh retailer code pehle se maujood hai.");
        return;
      }

      retailers.push({ name: name, code: code });

      localStorage.setItem(
        "rczoneDemoRetailers",
        JSON.stringify(retailers)
      );

      retailerForm.reset();
      renderRetailers();
      alert("Demo retailer add ho gaya!");
    });

    renderRetailers();
  }

  // Demo service requests
  const serviceButtons = document.querySelectorAll("[data-service]");
  const serviceMessage = document.getElementById("serviceMessage");
  const requestList = document.getElementById("requestList");
  const requestCount = document.getElementById("requestCount");
  const clearRequests = document.getElementById("clearRequests");

  function renderRequests() {
    if (!requestList) return;

    const requests = JSON.parse(
      localStorage.getItem("rczoneDemoRequests") || "[]"
    );

    requestList.innerHTML = "";

    if (requestCount) requestCount.textContent = requests.length;

    if (requests.length === 0) {
      requestList.textContent =
        "No demo requests yet. Choose a category above to create a sample request.";
      requestList.className = "empty-state";
      return;
    }

    requestList.className = "";
    requests.forEach(function (request) {
      const item = document.createElement("div");
      item.className = "notice";
      item.textContent = request.service + " — Demo request";
      requestList.appendChild(item);
    });
  }

  serviceButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const service = button.dataset.service;
      const requests = JSON.parse(
        localStorage.getItem("rczoneDemoRequests") || "[]"
      );

      requests.push({ service: service, createdAt: new Date().toISOString() });
      localStorage.setItem(
        "rczoneDemoRequests",
        JSON.stringify(requests)
      );

      if (serviceMessage) {
        serviceMessage.hidden = false;
        serviceMessage.textContent =
          service + " ki demo request ban gayi. Yeh real service nahi hai.";
      }

      renderRequests();
    });
  });

  if (clearRequests) {
    clearRequests.addEventListener("click", function () {
      localStorage.removeItem("rczoneDemoRequests");
      renderRequests();
    });
  }

  // Show selected demo role
  const roleLabel = document.getElementById("roleLabel");
  const savedRole = localStorage.getItem("rczoneDemoRole");

  if (roleLabel && savedRole) {
    roleLabel.textContent =
      savedRole === "admin" ? "Admin preview" : "Retailer demo";
  }

  renderRequests();
});
