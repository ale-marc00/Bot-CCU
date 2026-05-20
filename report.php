<?php
include("header.php");
include("connessione.php");
include("config.php");
include("dati.php");

$inizioSettimana = date("Y-m-d 00:00:00", strtotime("monday this week"));
$fineSettimana = date("Y-m-d 23:59:59", strtotime("sunday this week"));

function getMembroDiscord($userId, $guildId, $botToken) {
    $url = "https://discord.com/api/v10/guilds/$guildId/members/$userId";

    $ch = curl_init($url);

    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: Bot $botToken",
        "Content-Type: application/json"
    ]);

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

    $risposta = curl_exec($ch);
    $erroreCurl = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    if ($erroreCurl || $httpCode !== 200) {
        return null;
    }

    return json_decode($risposta, true);
}

function utenteHaRuoloDiscord($userId, $guildId, $botToken, $roleId) {
    $membro = getMembroDiscord($userId, $guildId, $botToken);

    if ($membro === null) {
        return false;
    }

    if (!isset($membro["roles"])) {
        return false;
    }

    return in_array($roleId, $membro["roles"]);
}

function getPesoRuoloPiuAlto($userId, $guildId, $botToken, $gerarchiaRuoli) {
    $membro = getMembroDiscord($userId, $guildId, $botToken);

    if ($membro === null) {
        return 999;
    }

    if (!isset($membro["roles"])) {
        return 999;
    }

    $pesoMigliore = 999;

    foreach ($membro["roles"] as $ruoloId) {
        if (isset($gerarchiaRuoli[$ruoloId])) {
            if ($gerarchiaRuoli[$ruoloId] < $pesoMigliore) {
                $pesoMigliore = $gerarchiaRuoli[$ruoloId];
            }
        }
    }

    return $pesoMigliore;
}

function trovaBestPerRuolo($classifica, $guildId, $botToken, $roleId) {
    $bestId = null;
    $bestCartellini = 0;

    foreach ($classifica as $idDiscord => $dati) {
        $cartelliniTotali = $dati["hacking"] + $dati["pattugliamenti"];

        if (utenteHaRuoloDiscord($idDiscord, $guildId, $botToken, $roleId)) {
            if ($cartelliniTotali > $bestCartellini) {
                $bestId = $idDiscord;
                $bestCartellini = $cartelliniTotali;
            }
        }
    }

    return [
        "id" => $bestId,
        "cartellini" => $bestCartellini
    ];
}



$classifica = [];

$totHacking = 0;
$totPattugliamenti = 0;

$sqlHacking = "
    SELECT hp.discord_id
    FROM hacking_partecipanti hp
    INNER JOIN hacking h ON hp.hacking_id = h.id
    WHERE hp.ruolo = 'presenza'
    AND h.created_at BETWEEN ? AND ?
";

$stmt = $conn->prepare($sqlHacking);
$stmt->execute([$inizioSettimana, $fineSettimana]);

while ($riga = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $id = $riga["discord_id"];

    if (!isset($classifica[$id])) {
        $classifica[$id] = [
            "hacking" => 0,
            "pattugliamenti" => 0,
            "peso_ruolo" => 999
        ];
    }

    $classifica[$id]["hacking"]++;
    $totHacking++;
}

$sqlPattugliamenti = "
    SELECT pp.discord_id
    FROM pattugliamenti_partecipanti pp
    INNER JOIN pattugliamenti p ON pp.pattugliamenti_id = p.id
    WHERE pp.ruolo = 'presenza'
    AND p.created_at BETWEEN ? AND ?
";

$stmt = $conn->prepare($sqlPattugliamenti);
$stmt->execute([$inizioSettimana, $fineSettimana]);

while ($riga = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $id = $riga["discord_id"];

    if (!isset($classifica[$id])) {
        $classifica[$id] = [
            "hacking" => 0,
            "pattugliamenti" => 0,
            "peso_ruolo" => 999
        ];
    }

    $classifica[$id]["pattugliamenti"]++;
    $totPattugliamenti++;
}

$totcartellini = $totHacking + $totPattugliamenti;

foreach ($classifica as $idDiscord => $dati) {
    $classifica[$idDiscord]["peso_ruolo"] = getPesoRuoloPiuAlto(
        $idDiscord,
        $guildId,
        $botToken,
        $gerarchiaRuoli
    );
}

uasort($classifica, function ($a, $b) {
    $totA = $a["hacking"] + $a["pattugliamenti"];
    $totB = $b["hacking"] + $b["pattugliamenti"];

    if ($totA !== $totB) {
        return $totB <=> $totA;
    }

    return $a["peso_ruolo"] <=> $b["peso_ruolo"];
});

$bestCcu = trovaBestPerRuolo($classifica, $guildId, $botToken, $ruoloCcu);
$bestHacker = trovaBestPerRuolo($classifica, $guildId, $botToken, $ruoloHacker);

$nomeBestCcu = "Nessuno";
$nomeBestHacker = "Nessuno";

if ($bestCcu["id"] !== null) {
    $nomeBestCcu = getNomeDiscord($bestCcu["id"], $guildId, $botToken);
}

if ($bestHacker["id"] !== null) {
    $nomeBestHacker = getNomeDiscord($bestHacker["id"], $guildId, $botToken);
}
?>

<body>

<div class="header">
    <h1 class="rtitolo">👨🏽‍💻 REPORT CCU 👨🏽‍💻</h1>
</div>

<div class="riq-tab">
    <div class="riquadro">
        <b>Hacking Totali</b>
        <p><?php echo $totHacking; ?></p>
    </div>

    <div class="riquadro">
        <b>Pattugliamenti Totali</b>
        <p><?php echo $totPattugliamenti; ?></p>
    </div>

    <div class="riquadro">
        <b>Best CCU</b>
        <p>
            <?php echo htmlspecialchars($nomeBestCcu); ?>
            (<?php echo $bestCcu["cartellini"]; ?>)
        </p>
    </div>

    <div class="riquadro">
        <b>Best Hacker</b>
        <p>
            <?php echo htmlspecialchars($nomeBestHacker); ?>
            (<?php echo $bestHacker["cartellini"]; ?>)
        </p>
    </div>
</div>

<div class="table-wrapper">
    <div class="table-container">

        <div class="cerca">
            <input
                type="text"
                id="cercaAgente"
                placeholder="Cerca agente..."
                onkeyup="filtraAgenti()"
            >
        </div>

        <table id="tabellaAgenti">
            <tr class="tit-tabella">
                <th class="tit-tabella"><b>Nome Discord</b></th>
                <th class="tit-tabella"><b>Hacking settimanali</b></th>
                <th class="tit-tabella"><b>Pattugliamenti settimanali</b></th>
                <th class="tit-tabella"><b>Promosso</b></th>
            </tr>

            <?php foreach ($classifica as $idDiscord => $dati): ?>
                <?php
                $nomeDiscord = getNomeDiscord($idDiscord, $guildId, $botToken);
                $cartellinitot = $dati["hacking"] + $dati["pattugliamenti"];

                if ($cartellinitot >= 3) {
                    $promosso = "Si";
                    $classeRiga = "riga-promosso";
                } else {
                    $promosso = "No";
                    $classeRiga = "riga-non-promosso";
                }
                ?>

                <tr class="<?php echo $classeRiga; ?>">
                    <td>
                        <b>
                            <span class="icon-user">👤</span>
                            <?php echo htmlspecialchars($nomeDiscord); ?>
                        </b>
                    </td>

                    <td>
                        <b><?php echo $dati["hacking"]; ?></b>
                    </td>

                    <td>
                        <b><?php echo $dati["pattugliamenti"]; ?></b>
                    </td>

                    <td>
                        <b><?php echo $promosso; ?></b>
                    </td>
                </tr>
            <?php endforeach; ?>
        </table>

    </div>
</div>

<script>
function filtraAgenti() {
    let input = document.getElementById("cercaAgente");
    let filtro = input.value.toLowerCase();
    let tabella = document.getElementById("tabellaAgenti");
    let righe = tabella.getElementsByTagName("tr");

    for (let i = 1; i < righe.length; i++) {
        let primaCella = righe[i].getElementsByTagName("td")[0];

        if (primaCella) {
            let testo = primaCella.textContent || primaCella.innerText;

            if (testo.toLowerCase().includes(filtro)) {
                righe[i].style.display = "";
            } else {
                righe[i].style.display = "none";
            }
        }
    }
}
</script>
</body>