<?php

function getNomeDiscord($userId, $guildId, $botToken) {
    $url = "https://discord.com/api/v10/guilds/$guildId/members/$userId";

    $ch = curl_init($url);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bot $botToken",
            "Content-Type: application/json"
        ]
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    curl_close($ch);

    if ($httpCode !== 200) {
        return "Utente non trovato";
    }

    $data = json_decode($response, true);

    if (!empty($data["nick"])) {
        return $data["nick"];
    }

    if (!empty($data["user"]["global_name"])) {
        return $data["user"]["global_name"];
    }

    return $data["user"]["username"] ?? "Sconosciuto";
}