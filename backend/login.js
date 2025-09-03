// ===== DOM ELEMENTS =====
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');
const toggleIcon = document.getElementById('toggle-icon');
const loginBtn = document.getElementById('login-btn');
const errorMessage = document.getElementById('error-message');

// ===== PASSWORD TOGGLE FUNCTIONALITY =====
passwordToggle.addEventListener('click', function() {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    
    // Toggle icon
    if (type === 'text') {
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
});

// ===== LOGIN FORM SUBMISSION =====
loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    // Hide error message
    errorMessage.classList.remove('show');
    
    // Show loading state
    loginBtn.classList.add('loading');
    
    // Simple authentication (replace with your actual auth logic)
    setTimeout(() => {
        if (username === 'admin' && password === 'Oğuzhan36.') {
            // Set authentication cookie (index.js bunu kontrol ediyor)
            document.cookie = 'user_session=authenticated; path=/; max-age=86400'; // 1 day
            
            // Redirect to main page
            window.location.href = '/';
        } else {
            // Show error message
            errorMessage.classList.add('show');
            loginBtn.classList.remove('loading');
            
            // Shake animation for inputs
            usernameInput.style.animation = 'shake 0.5s ease-in-out';
            passwordInput.style.animation = 'shake 0.5s ease-in-out';
            
            setTimeout(() => {
                usernameInput.style.animation = '';
                passwordInput.style.animation = '';
            }, 500);
        }
    }, 1000); // Simulate network delay
});

// ===== INPUT FOCUS EFFECTS =====
const inputs = document.querySelectorAll('.input-wrapper input');

inputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.parentElement.classList.add('focused');
    });
    
    input.addEventListener('blur', function() {
        this.parentElement.classList.remove('focused');
    });
});

// ===== CHECK IF ALREADY AUTHENTICATED =====
document.addEventListener('DOMContentLoaded', function() {
    const cookies = document.cookie.split(';');
    const isAuthenticated = cookies.some(cookie => 
        cookie.trim().startsWith('user_session=authenticated')
    );
    
    if (isAuthenticated) {
        window.location.href = '/';
    }
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', function(e) {
    // Enter key to submit form
    if (e.key === 'Enter' && (usernameInput === document.activeElement || passwordInput === document.activeElement)) {
        loginForm.dispatchEvent(new Event('submit'));
    }
});

// ===== FORM VALIDATION =====
function validateForm() {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    if (username.length < 3) {
        showError('Kullanıcı adı en az 3 karakter olmalıdır');
        return false;
    }
    
    if (password.length < 6) {
        showError('Şifre en az 6 karakter olmalıdır');
        return false;
    }
    
    return true;
}

function showError(message) {
    errorMessage.querySelector('span').textContent = message;
    errorMessage.classList.add('show');
    
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 5000);
}

// ===== SMOOTH ANIMATIONS =====
window.addEventListener('load', function() {
    document.body.style.opacity = '1';
});
