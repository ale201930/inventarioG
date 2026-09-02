// assets/js/inventario.js
document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('inventarioTableBody');
  if (!tableBody) return;

  const modal = document.getElementById('productoModal');
  const btnNuevo = document.getElementById('btnNuevoProducto');
  const btnClose = document.getElementById('btnModalClose');
  const form = document.getElementById('productoForm');
  const searchInput = document.getElementById('searchProducto');

  let productos = [];

  // Cargar productos
  async function loadProductos() {
    const res = await API.get('api/inventario.php');
    if (res.success) {
      productos = res.data;
      renderTable(productos);
    }
  }

  // Renderizar tabla
  function renderTable(list) {
    if (list.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay productos registrados</td></tr>`;
      return;
    }

    tableBody.innerHTML = list.map(p => {
      const pv1 = parseFloat(p.precio_venta1 || p.precio_unitario || 0);
      const pv2 = parseFloat(p.precio_venta2 || 0);
      const pv3 = parseFloat(p.precio_venta3 || 0);

      return `
        <tr>
          <td><strong>${p.nombre}</strong></td>
          <td>
            <span class="badge ${p.cantidad > 5 ? 'badge-success' : (p.cantidad > 0 ? 'badge-warning' : 'badge-danger')}">
              ${p.cantidad} und.
            </span>
          </td>
          <td>$${parseFloat(p.costo_unitario).toFixed(2)}</td>
          <td><strong style="color: #0284c7;">$${pv1.toFixed(2)}</strong></td>
          <td>${pv2 > 0 ? '$' + pv2.toFixed(2) : '<span style="color:#94a3b8;">-</span>'}</td>
          <td>${pv3 > 0 ? '$' + pv3.toFixed(2) : '<span style="color:#94a3b8;">-</span>'}</td>
          <td>
            <button class="btn btn-secondary btn-sm edit-btn" data-id="${p.id}">Editar</button>
            <button class="btn btn-danger btn-sm delete-btn" data-id="${p.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');

    // Eventos de botones
    document.querySelectorAll('.edit-btn').forEach(b => {
      b.addEventListener('click', (e) => openModal(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(b => {
      b.addEventListener('click', (e) => deleteProducto(e.target.dataset.id));
    });
  }

  // Modal
  function openModal(id = null) {
    form.reset();
    document.getElementById('prodId').value = '';

    if (id) {
      const p = productos.find(item => item.id === id);
      if (p) {
        document.getElementById('prodId').value = p.id;
        document.getElementById('prodNombre').value = p.nombre;
        document.getElementById('prodCantidad').value = p.cantidad;
        document.getElementById('prodCosto').value = p.costo_unitario;
        document.getElementById('prodPrecio1').value = p.precio_venta1 || p.precio_unitario || 0;
        document.getElementById('prodPrecio2').value = p.precio_venta2 || 0;
        document.getElementById('prodPrecio3').value = p.precio_venta3 || 0;
        document.getElementById('modalTitle').textContent = 'Editar Producto';
      }
    } else {
      document.getElementById('modalTitle').textContent = 'Nuevo Producto';
    }

    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
  }

  btnNuevo?.addEventListener('click', () => openModal());
  btnClose?.addEventListener('click', closeModal);

  // Guardar producto
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const pv1 = parseFloat(document.getElementById('prodPrecio1').value) || 0;
    const pv2 = parseFloat(document.getElementById('prodPrecio2').value) || 0;
    const pv3 = parseFloat(document.getElementById('prodPrecio3').value) || 0;

    const payload = {
      id: id || undefined,
      nombre: document.getElementById('prodNombre').value,
      cantidad: parseInt(document.getElementById('prodCantidad').value) || 0,
      costoUnitario: parseFloat(document.getElementById('prodCosto').value) || 0,
      precioVenta1: pv1,
      precioVenta2: pv2,
      precioVenta3: pv3,
      precioUnitario: pv1
    };

    let res;
    if (id) {
      res = await API.put('api/inventario.php', payload);
    } else {
      res = await API.post('api/inventario.php', payload);
    }

    if (res.success) {
      closeModal();
      loadProductos();
    } else {
      alert(res.error || 'Error al guardar producto');
    }
  });

  // Eliminar producto
  async function deleteProducto(id) {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      const res = await API.delete('api/inventario.php', { id });
      if (res.success) {
        loadProductos();
      } else {
        alert(res.error || 'Error al eliminar');
      }
    }
  }

  // Búsqueda en vivo
  searchInput?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = productos.filter(p => p.nombre.toLowerCase().includes(term));
    renderTable(filtered);
  });

  loadProductos();
});
