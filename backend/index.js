document.addEventListener('DOMContentLoaded', function () {
  const userSession = getCookie('user_session');
  if (!userSession) {
    window.location.href = 'login.html';
  }

  // History uyarısını önlemek için sadece gerekli durumlarda kullan
  if (window.history.length === 1) {
    window.history.replaceState(null, null, window.location.href);
  }

  const toggleBtn = document.getElementById('theme-toggle');
  const currentTheme = getCookie('theme');
  if (currentTheme) {
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(currentTheme);
    
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = currentTheme === 'dark-theme' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  toggleBtn.addEventListener('click', function () {
    const newTheme = document.body.classList.contains('dark-theme') ? 'light-theme' : 'dark-theme';
    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(newTheme);
    
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = newTheme === 'dark-theme' ? 'fas fa-moon' : 'fas fa-sun';
    }
    
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
  let searchQuery = '';

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
    const container = document.getElementById('news-grid');
    const loading = document.getElementById('loading');
    const newsCountElement = document.getElementById('news-count');
    
    if (!container) return;
    
    // Hide loading spinner
    if (loading) {
      loading.style.display = 'none';
    }
    
    // Update news count
    if (newsCountElement) {
      newsCountElement.textContent = filteredNews.length;
    }
    
    // DOM temizleme - memory leak önleme
    const existingCards = container.querySelectorAll('.news-card');
    existingCards.forEach(card => {
      // Event listener'ları temizle
      const links = card.querySelectorAll('a');
      links.forEach(link => {
        link.onclick = null;
      });
    });
    
    container.innerHTML = "";
    const currentNews = filteredNews.slice(0, newsCount);
    
    // DocumentFragment kullanarak performans artırma
    const fragment = document.createDocumentFragment();
    
    currentNews.forEach((haber, index) => {
      const card = document.createElement('article');
      card.classList.add('news-card');
      card.style.animationDelay = `${index * 0.1}s`;
      
      let baslik = haber.baslik ? haber.baslik.split(' ').slice(0, 30).join(' ') : 'Başlık bulunamadı';
      if (baslik.split(' ').length > 10) {
        baslik += '...';
      }
      
      let aciklama = haber.aciklama ? haber.aciklama.split(' ').slice(0, 20).join(' ') : '';
      if (aciklama.split(' ').length > 10) {
        aciklama += '...';
      }
  
      const resim = haber.resim ? `<img src="${haber.resim}" alt="Haber Resmi" class="news-image" loading="lazy">` : '';
      const formattedDate = formatDate(haber.timestamp, haber.saat);
      
      const source = haber.source ? `<span class="news-source">${haber.source}</span>` : '';
      card.innerHTML = `
        ${resim}
        <div class="news-content">
          <h2 class="news-title">${baslik}</h2>
          <p class="news-description">${aciklama}</p>
          <div class="news-meta">
            ${source}
            <span class="news-timestamp">${formattedDate}</span>
          </div>
          <a href="${haber.link}" target="_blank" class="news-link">
            Devamını Oku <i class="fas fa-arrow-right"></i>
          </a>
        </div>`;
   
      fragment.appendChild(card);
    });
    
    // Tek seferde DOM'a ekle
    container.appendChild(fragment);
  }
    
  function filterNews() {
    const now = Date.now();
    filteredNews = allNews.filter(haber => {
        // Site arama filtresi
        if (searchQuery) {
            const sourceMatch = haber.source && haber.source.toLowerCase().includes(searchQuery.toLowerCase());
            if (!sourceMatch) return false;
        }

        // Zaman filtresi
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
    filteredNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    loadNews();
}

  
  // Throttled scroll event for better performance
  let scrollTimeout;
  window.addEventListener('scroll', function () {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
    }
    
    scrollTimeout = setTimeout(() => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 100) {
        if (newsCount < filteredNews.length) {
          newsCount += 25;
          loadNews();
        }
      }
    }, 100);
  });

  const evtSource = new EventSource("/stream");
  let lastNewsHash = '';
  let isFirstLoad = true;
  
  evtSource.onmessage = function (event) {
    const newData = event.data;
    
    // Heartbeat mesajlarını atla
    if (newData === ':') {
      return;
    }
    
    // Veri işleme
    try {
      let newsData = newData;
      
      // Eğer data: prefix'i varsa kaldır
      if (newData.startsWith('data: ')) {
        newsData = newData.replace('data: ', '');
      }
      
      // JSON parse et
      const parsedData = JSON.parse(newsData);
      
      // Basit hash - btoa yerine string uzunluğu kullan
      const newHash = newsData.length + '_' + newsData.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
      
      // İlk yükleme veya veri değiştiyse güncelle
      if (isFirstLoad || newHash !== lastNewsHash) {
        isFirstLoad = false;
        lastNewsHash = newHash;
        allNews = parsedData;
        allNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        filterNews();
      }
    } catch (error) {
      console.log('Veri işleme hatası:', error);
    }
  };
  
  // EventSource hata yönetimi
  evtSource.onerror = function(event) {
    console.log('EventSource bağlantı hatası');
    // Sürekli yeniden yüklemeyi önlemek için sadece kritik durumlarda reload yap
    if (evtSource.readyState === EventSource.CLOSED) {
      console.log('EventSource bağlantısı kapandı, 10 saniye sonra yeniden denenecek');
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          location.reload();
        }
      }, 10000);
    }
  };
  document.getElementById('last-hour-filter').addEventListener('click', function () {
    filterType = 'last-hour';
    filterNews();
    setActiveFilter(this);
    closeSidebar(); // Sidebar'ı kapat
  });

  document.getElementById('last-6-hours-filter').addEventListener('click', function () {
    filterType = 'last-6-hours';
    filterNews();
    setActiveFilter(this);
    closeSidebar(); // Sidebar'ı kapat
  });

  document.getElementById('last-12-hours-filter').addEventListener('click', function () {
    filterType = 'last-12-hours';
    filterNews();
    setActiveFilter(this);
    closeSidebar(); // Sidebar'ı kapat
  });

  function setActiveFilter(selectedFilter) {
    const filters = document.querySelectorAll('#sidebar ul li a');
    filters.forEach(filter => filter.classList.remove('active'));
    selectedFilter.classList.add('active');
  }

  // Sidebar'ı kapat
  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (sidebar && overlay) {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
      document.body.style.overflow = 'auto';
    }
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

  // Menu toggle functionality
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  
  if (menuToggle && sidebar && overlay) {
    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('show');
      overlay.classList.toggle('show');
      document.body.style.overflow = sidebar.classList.contains('show') ? 'hidden' : 'auto';
    });
    
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('show');
      overlay.classList.remove('show');
      document.body.style.overflow = 'auto';
    });
  }

  // Back to top button
  const backToTopBtn = document.getElementById('back-to-top');
  if (backToTopBtn) {
    let backToTopTimeout;
    window.addEventListener('scroll', function () {
      if (backToTopTimeout) {
        clearTimeout(backToTopTimeout);
      }
      
      backToTopTimeout = setTimeout(() => {
        if (window.pageYOffset > 300) {
          backToTopBtn.classList.add('show');
        } else {
          backToTopBtn.classList.remove('show');
        }
      }, 50);
    });
    
    backToTopBtn.addEventListener('click', function () {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // Site search functionality
  const siteSearch = document.getElementById('site-search');
  const clearSearch = document.getElementById('clear-search');
  
  if (siteSearch && clearSearch) {
    let searchTimeout;
    
    // Arama kutusu değişiklik eventi (debounced)
    siteSearch.addEventListener('input', function() {
      searchQuery = this.value.trim();
      
      // Clear butonunu göster/gizle
      if (searchQuery) {
        clearSearch.classList.add('show');
      } else {
        clearSearch.classList.remove('show');
      }
      
      // Debounce filtreleme işlemi (300ms bekle)
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        filterNews();
      }, 300);
    });
    
    // Clear buton eventi
    clearSearch.addEventListener('click', function() {
      siteSearch.value = '';
      searchQuery = '';
      clearSearch.classList.remove('show');
      filterNews();
    });
    
    // Enter tuşu ile arama
    siteSearch.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        filterNews();
      }
    });
  }
});
