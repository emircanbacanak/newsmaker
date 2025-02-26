document.addEventListener('DOMContentLoaded', function () {
    // Kullanıcı oturumunu kontrol et
    const userSession = getCookie('user_session');
    if (userSession) {
      // Eğer oturum açıksa, index sayfasına yönlendir
      window.location.href = 'index.html';
    }
  
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', function (event) {
      event.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
  
      // Kullanıcı adı ve şifre kontrolü (bu örnekte sabit kontrol ediyoruz)
      if (username === 'admin' && password === 'password123') {
        // Başarılı giriş, çerezlere kaydet
        setCookie('user_session', 'active', 1);  // 1 gün boyunca oturumu sakla
        window.location.href = 'index.html';  // Ana sayfaya yönlendir
      } else {
        // Hatalı giriş
        const errorMessage = document.getElementById('error-message');
        errorMessage.style.display = 'block';
      }
    });
  
    // Çerezleri ayarlama fonksiyonu
    function setCookie(name, value, days) {
      const d = new Date();
      d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
      let expires = "expires=" + d.toUTCString();
      document.cookie = name + "=" + value + ";" + expires + ";path=/";
    }
  
    // Çerez okuma fonksiyonu
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
  