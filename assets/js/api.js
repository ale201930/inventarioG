// assets/js/api.js
// Centralized API Client Helper

const API = {
  async get(url) {
    try {
      const sep = url.includes('?') ? '&' : '?';
      const cleanUrl = `${url}${sep}_t=${Date.now()}`;
      const response = await fetch(cleanUrl, { cache: 'no-store' });
      if (!response.ok) {
        return { success: false, error: `Error del servidor (HTTP ${response.status})` };
      }
      return await response.json();
    } catch (error) {
      console.error('API GET Error:', error);
      return { success: false, error: 'Error de red o servidor: ' + (error.message || error) };
    }
  },

  async post(url, data) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        cache: 'no-store'
      });
      if (!response.ok) {
        return { success: false, error: `Error del servidor (HTTP ${response.status})` };
      }
      return await response.json();
    } catch (error) {
      console.error('API POST Error:', error);
      return { success: false, error: 'Error de red o servidor: ' + (error.message || error) };
    }
  },

  async put(url, data) {
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        cache: 'no-store'
      });
      if (!response.ok) {
        return { success: false, error: `Error del servidor (HTTP ${response.status})` };
      }
      return await response.json();
    } catch (error) {
      console.error('API PUT Error:', error);
      return { success: false, error: 'Error de red o servidor: ' + (error.message || error) };
    }
  },

  async delete(url, data = {}) {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        cache: 'no-store'
      });
      if (!response.ok) {
        return { success: false, error: `Error del servidor (HTTP ${response.status})` };
      }
      return await response.json();
    } catch (error) {
      console.error('API DELETE Error:', error);
      return { success: false, error: 'Error de red o servidor: ' + (error.message || error) };
    }
  }
};
