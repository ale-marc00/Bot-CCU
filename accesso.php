<?php
$errorePin = "Inserisci PIN";
$pinCorretto = "0000";

if (isset($_POST["accedi"])) {
    $pinInserito = $_POST["pinInput"] ?? "";

    if ($pinInserito === $pinCorretto) {
        $_SESSION["accesso_consentito"] = true;
        header("Location: report.php");
        exit;
    } else {
        $errorePin = "Pin errato";
        header("Location: index.php");
    }
}
?>