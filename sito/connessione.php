<?php
$host = "metro.proxy.rlwy.net";
$port = "45480";
$dbname = "railway";
$username = "root";
$password = "yGxCXrZPgJAJNetpSaWfxGcLWPGFwuOB";

try {
    $conn = new PDO(
        "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4",
        $username,
        $password
    );

    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);


} catch (PDOException $e) {
    die("Errore di connessione: " . $e->getMessage());
}
?>