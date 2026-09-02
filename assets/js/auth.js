// assets/js/auth.js
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const errorBox = document.getElementById('loginError');

    errorBox.style.display = 'none';

    const res = await API.post('api/auth.php?action=login', { email, password });
    if (res.success) {
      window.location.href = 'index.php?route=dashboard';
    } else {
      errorBox.textContent = res.error || 'Credenciales incorrectas';
      errorBox.style.display = 'block';
    }
  });
});
