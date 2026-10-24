document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("demoLogin");

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const role = document.getElementById("role").value;

      localStorage.setItem("rczoneDemoRole", role);

      window.location.href = "dashboard.html";
    });
  }
});
