<?php
// includes/footer.php - Con salidas_v2.js
?>
<script src="assets/js/html2pdf.bundle.min.js?v=<?= time() ?>"></script>
<script src="assets/js/api.js?v=<?= time() ?>"></script>
<script src="assets/js/pwa.js?v=<?= time() ?>"></script>
<script src="assets/js/bcv_widget.js?v=<?= time() ?>"></script>
<?php
$route = $_GET['route'] ?? 'dashboard';
$ver = time();
switch($route) {
    case 'dashboard':
        echo "<script src=\"assets/js/dashboard.js?v={$ver}\"></script>";
        break;
    case 'inventario':
        echo "<script src=\"assets/js/inventario.js?v={$ver}\"></script>";
        break;
    case 'entradas':
        echo "<script src=\"assets/js/entradas.js?v={$ver}\"></script>";
        break;
    case 'salidas':
        echo "<script src=\"assets/js/salidas_v2.js?v={$ver}\"></script>";
        break;
    case 'reportes':
        echo "<script src=\"assets/js/reportes.js?v={$ver}\"></script>";
        break;
    case 'login':
        echo "<script src=\"assets/js/auth.js?v={$ver}\"></script>";
        break;
}
?>
</body>
</html>
