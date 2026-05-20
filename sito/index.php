<?php
include("header.php");
include("accesso.php");
?>

<body>
    <div id="login-box">
        <h2>🔒 Accesso Riservato</h2>
        <p>Inserisci il PIN per visualizzare il report</p>

        <form method="POST" action="accesso.php">
            <input
                type="password"
                name="pinInput"
                id="pinInput"
                placeholder="<?php echo $errorePin; ?>"
                autofocus
            >
            <button type="submit" id="accedi" name="accedi">Accedi</button>
        </form>
    </div>
</body>
</html>