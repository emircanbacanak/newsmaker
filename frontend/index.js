document.addEventListener('DOMContentLoaded', function () {
  const userSession = getCookie('user_session');
  if (!userSession) {
    window.location.href = 'login.html';
  }

  window.history.pushState(null, null, window.location.href);
  window.onpopstate = function () {
    window.history.go(1);
  };

  const toggleBtn = document.getElementById('theme-toggle');
  const currentTheme = getCookie('theme');
  if (currentTheme) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(currentTheme);
    toggleBtn.innerHTML = currentTheme === 'dark-theme' ? '🌙' : '☀️';
  }

  toggleBtn.addEventListener('click', function () {
    const newTheme = document.body.classList.contains('dark-theme') ? 'light-theme' : 'dark-theme';
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(newTheme);
    toggleBtn.innerHTML = newTheme === 'dark-theme' ? '🌙' : '☀️';
    setCookie('theme', newTheme, 365); 
  });

  const logoutBtn = document.getElementById('logout-button');
  logoutBtn.addEventListener('click', function () {
    deleteCookie('user_session');
    window.history.replaceState(null, null, 'login.html');
    window.location.replace('login.html');
  });

  let newsCount = 25;
  let allNews = [];
  let filteredNews = [];
  let filterType = 'last-hour';

  function formatDate(timestamp, saat) {
    if (saat === "null") {
      return timestamp;
    }
    let date = new Date(timestamp);
    let formattedDate = date.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
    let time = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
    
    return `${formattedDate} ${time}`;
  }
  
  function loadNews() {
    const container = document.querySelector('.haberler-container');
    container.innerHTML = "";
    const currentNews = filteredNews.slice(0, newsCount);
    currentNews.forEach(haber => {
      const card = document.createElement('div');
      card.classList.add('kart');
      
      let baslik = haber.baslik ? haber.baslik.split(' ').slice(0, 30).join(' ') : 'Başlık bulunamadı';
      if (baslik.split(' ').length > 10) {
        baslik += '...';
      }
      
      let aciklama = haber.aciklama ? haber.aciklama.split(' ').slice(0, 20).join(' ') : '';
      if (aciklama.split(' ').length > 10) {
        aciklama += '...';
      }
  
      const resim = haber.resim ? `<img src="${haber.resim}" alt="Haber Resmi">` : '';
      const formattedDate = formatDate(haber.timestamp, haber.saat);
      
      const source = haber.source ? `<p><strong>Kaynak:</strong> ${haber.source}</p>` : '';
      card.innerHTML = `
        ${resim}
        <h2>${baslik}</h2>
        <p>${aciklama}</p>
        <a href="${haber.link}" target="_blank">Devamını oku</a>
        <p class="timestamp">Eklenme zamanı: ${formattedDate}</p>
        ${source}`;
   
      container.appendChild(card);
    });
  }
    
  function filterNews() {
    const now = Date.now();
    filteredNews = allNews.filter(haber => {
      if (haber.source === "animalpolitico.com") {
        return true; 
      }
  
      const timestamp = new Date(haber.timestamp).getTime();
      let timeDiff = now - timestamp;
      switch (filterType) {
        case 'last-hour':
          return timeDiff <= 60 * 60 * 1000;
        case 'last-6-hours':
          return timeDiff <= 6 * 60 * 60 * 1000;
        case 'last-12-hours':
          return timeDiff <= 12 * 60 * 60 * 1000;
        default:
          return true;
      }
    });
    loadNews();
  }
  
  window.addEventListener('scroll', function () {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
      if (newsCount < filteredNews.length) {
        newsCount += 25;
        loadNews();
      }
    }
  });

  const evtSource = new EventSource("/stream");
  evtSource.onmessage = function (event) {
    allNews = JSON.parse(event.data);
    filterNews();
  };

  document.getElementById('last-hour-filter').addEventListener('click', function () {
    filterType = 'last-hour';
    filterNews();
    setActiveFilter(this);
  });

  document.getElementById('last-6-hours-filter').addEventListener('click', function () {
    filterType = 'last-6-hours';
    filterNews();
    setActiveFilter(this);
  });

  document.getElementById('last-12-hours-filter').addEventListener('click', function () {
    filterType = 'last-12-hours';
    filterNews();
    setActiveFilter(this);
  });

  function setActiveFilter(selectedFilter) {
    const filters = document.querySelectorAll('#sidebar ul li a');
    filters.forEach(filter => filter.classList.remove('active'));
    selectedFilter.classList.add('active');
  }

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

  function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  }

  const menuIcon = document.getElementById('menu-icon');
  const sidebar = document.getElementById('sidebar');
  menuIcon.addEventListener('click', function () {
    sidebar.classList.toggle('show');
  });
});
