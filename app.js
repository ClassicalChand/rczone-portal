// RCZONE - Demo Portal JavaScript
document.addEventListener("DOMContentLoaded", function () {
  // Current year, if a footer element exists
  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  // Demo login only: this does NOT authenticate real users.
  const loginForm = document.querySelector("form");
  if (loginForm && window.location.pathname.endsWith("login.html")) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      alert(
        "RCZONE Demo Portal: यह केवल डेमो है। वास्तविक लॉगिन के लिए सुरक्षित backend जोड़ना होगा।"
      );
    });
  }

  // Mark demo buttons clearly
  document.querySelectorAll("[data-demo]").forEach(function (button) {
    button.addEventListener("click", function () {
      alert("यह सुविधा अभी डेमो मोड में है।");
    });
  });

  console.log("RCZONE demo portal loaded.");
});
