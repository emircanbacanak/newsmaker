document.addEventListener('DOMContentLoaded', function () {
    const userSession = getCookie('user_session');
    if (userSession) {
      window.location.href = 'index.html';
    }
  
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
  
      if (username === 'admin' && password === 'Oğuzhan36.') {
        setCookie('user_session', 'active', 1);
        window.location.href = 'index.html';
      } else {
        const errorMessage = document.getElementById('error-message');
        errorMessage.style.display = 'block';
      }
    });
  
    function setCookie(name, value, days) {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      let expires = "expires=" + d.toUTCString();
      document.cookie = name + "=" + value + ";" + expires + ";path=/";
    }
  
    function getCookie(name) {
      let nameEq = name + "=";
      let ca = document.cookie.split(';');
      for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEq) === 0) return c.substring(nameEq.length, c.length);
      }
      return "";
    }
  });
  