const {SlashCommandBuilder, EmbedBuilder} = require("discord.js");
const pool = require("../connessione");

function estraiIdsDiscord(testo) {
    if (!testo) return [];
    const matches = testo.match(/\d{17,20}/g);
    return matches ? [...new Set(matches)] : [];
}

async function creaPartecipantiDaIds(guild, ids, ruolo) {
    const risultati = [];

    for (const id of ids) {
        try {
            const membro = await guild.members.fetch(id);

            risultati.push({
                discord_id: membro.user.id,
                discord_username: membro.user.username,
                ruolo,
            });
        } catch (error) {
            console.error(`Impossibile recuperare il membro ${id}:`, error.message);
        }
    }

    return risultati;
}

async function cercaCartellino(connection, idGlobale) {
    let [rows] = await connection.execute(`SELECT *, 'hacking' AS tipo FROM hacking WHERE id_globale = ?`, [idGlobale]);

    if (rows.length > 0) return rows[0];

    [rows] = await connection.execute(`SELECT *, 'pattugliamenti' AS tipo FROM pattugliamenti WHERE id_globale = ?`, [
        idGlobale,
    ]);

    if (rows.length > 0) return rows[0];

    return null;
}

module.exports = {
    data: new SlashCommandBuilder()
    .setName("editcartellino")
    .setDescription("Modifica un cartellino tramite ID globale")

    .addStringOption((option) => option.setName("id").setDescription("ID globale del cartellino").setRequired(true))

    .addStringOption((option) => option.setName("presenze").setDescription("Nuove presenze").setRequired(false))

    .addStringOption((option) => option.setName("coordinatori").setDescription("Nuovi coordinatori").setRequired(false))

    .addStringOption((option) => option.setName("altocomando").setDescription("Nuovo alto comando").setRequired(false))

    .addStringOption((option) =>
        option
        .setName("esito")
        .setDescription("Nuovo esito")
        .setRequired(false)
        .addChoices({name: "Positivo", value: "positivo"}, {name: "Negativo", value: "negativo"})
    )

    .addIntegerOption((option) => option.setName("arresti").setDescription("Nuovo numero arresti").setRequired(false))

    .addStringOption((option) =>
        option.setName("refurtiva").setDescription("Nuova descrizione refurtiva").setRequired(false)
    )

    .addAttachmentOption((option) =>
        option.setName("refurtiva-img").setDescription("Nuova immagine refurtiva").setRequired(false)
    ),

    async execute(interaction) {
        let connection;

        try {
            await interaction.deferReply({ephemeral: true});

            const idGlobale = interaction.options.getString("id").toUpperCase();

            const nuovePresenze = interaction.options.getString("presenze");
            const nuoviCoordinatori = interaction.options.getString("coordinatori");
            const nuovoAltoComando = interaction.options.getString("altocomando");
            const nuovoEsito = interaction.options.getString("esito");
            const nuoviArresti = interaction.options.getInteger("arresti");
            const nuovaRefurtiva = interaction.options.getString("refurtiva");
            const nuovaRefurtivaImg = interaction.options.getAttachment("refurtiva-img");

            connection = await pool.getConnection();

            const cartellino = await cercaCartellino(connection, idGlobale);

            if (!cartellino) {
                return await interaction.editReply({
                    content: "Nessun cartellino trovato con questo ID globale.",
                });
            }

            const tipo = cartellino.tipo;

            const tabellaPrincipale = tipo === "hacking" ? "hacking" : "pattugliamenti";
            const tabellaPartecipanti = tipo === "hacking" ? "hacking_partecipanti" : "pattugliamenti_partecipanti";
            const colonnaIdPartecipanti = tipo === "hacking" ? "hacking_id" : "pattugliamenti_id";

            const idInterno = cartellino.id;

            const esitoFinale = nuovoEsito ?? cartellino.esito;
            const arrestiFinale = nuoviArresti ?? cartellino.arresti;
            const refurtivaFinale = nuovaRefurtiva ?? cartellino.refurtiva;
            const immagineFinale = nuovaRefurtivaImg ? nuovaRefurtivaImg.url : cartellino.refurtiva_img_url;

            if (esitoFinale === "positivo" && arrestiFinale === null) {
                return await interaction.editReply({
                    content: "Se l'esito è positivo, devi inserire il numero di arresti.",
                });
            }

            if (esitoFinale === "positivo" && !refurtivaFinale) {
                return await interaction.editReply({
                    content: "Se l'esito è positivo, devi inserire la refurtiva.",
                });
            }

            await connection.beginTransaction();

            await connection.execute(
                `
                UPDATE ${tabellaPrincipale}
                SET esito = ?,
                    arresti = ?,
                    refurtiva = ?,
                    refurtiva_img_url = ?
                WHERE id_globale = ?
                `,
                [esitoFinale, arrestiFinale, refurtivaFinale, immagineFinale, idGlobale]
            );

            if (nuovePresenze !== null) {
                await connection.execute(
                    `DELETE FROM ${tabellaPartecipanti} WHERE ${colonnaIdPartecipanti} = ? AND ruolo = ?`,
                    [idInterno, "presenza"]
                );

                const idsPresenze = estraiIdsDiscord(nuovePresenze);
                const partecipanti = await creaPartecipantiDaIds(interaction.guild, idsPresenze, "presenza");

                for (const p of partecipanti) {
                    await connection.execute(
                        `
                        INSERT INTO ${tabellaPartecipanti}
                        (${colonnaIdPartecipanti}, discord_id, discord_username, ruolo)
                        VALUES (?, ?, ?, ?)
                        `,
                        [idInterno, p.discord_id, p.discord_username, p.ruolo]
                    );
                }
            }

            if (nuoviCoordinatori !== null) {
                await connection.execute(
                    `DELETE FROM ${tabellaPartecipanti} WHERE ${colonnaIdPartecipanti} = ? AND ruolo = ?`,
                    [idInterno, "coordinatore"]
                );

                const idsCoordinatori = estraiIdsDiscord(nuoviCoordinatori);
                const partecipanti = await creaPartecipantiDaIds(interaction.guild, idsCoordinatori, "coordinatore");

                for (const p of partecipanti) {
                    await connection.execute(
                        `
                        INSERT INTO ${tabellaPartecipanti}
                        (${colonnaIdPartecipanti}, discord_id, discord_username, ruolo)
                        VALUES (?, ?, ?, ?)
                        `,
                        [idInterno, p.discord_id, p.discord_username, p.ruolo]
                    );
                }
            }

            if (nuovoAltoComando !== null) {
                await connection.execute(
                    `DELETE FROM ${tabellaPartecipanti} WHERE ${colonnaIdPartecipanti} = ? AND ruolo = ?`,
                    [idInterno, "altocomando"]
                );

                const idsAltoComando = estraiIdsDiscord(nuovoAltoComando);
                const partecipanti = await creaPartecipantiDaIds(interaction.guild, idsAltoComando, "altocomando");

                for (const p of partecipanti) {
                    await connection.execute(
                        `
                        INSERT INTO ${tabellaPartecipanti}
                        (${colonnaIdPartecipanti}, discord_id, discord_username, ruolo)
                        VALUES (?, ?, ?, ?)
                        `,
                        [idInterno, p.discord_id, p.discord_username, p.ruolo]
                    );
                }
            }

            await connection.commit();

            const [partecipantiRows] = await connection.execute(
                `
                SELECT discord_id, ruolo
                FROM ${tabellaPartecipanti}
                WHERE ${colonnaIdPartecipanti} = ?
                `,
                [idInterno]
            );

            const presenzeFinali =
                partecipantiRows
                .filter((p) => p.ruolo === "presenza")
                .map((p) => `<@${p.discord_id}>`)
                .join(", ") || "//";

            const coordinatoriFinali =
                partecipantiRows
                .filter((p) => p.ruolo === "coordinatore")
                .map((p) => `<@${p.discord_id}>`)
                .join(", ") || "//";

            const altoComandoFinale =
                partecipantiRows
                .filter((p) => p.ruolo === "altocomando")
                .map((p) => `<@${p.discord_id}>`)
                .join(", ") || "//";

            const dataOperazione = cartellino.created_at
                ? new Date(cartellino.created_at).toLocaleString("it-IT")
                : "//";

            const embed = new EmbedBuilder()
            .setColor(0x1f3c88)
            .setAuthor({
                name: tipo === "hacking" ? "CCU - Report Hacking" : "CCU - Report Pattugliamento",
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .setTitle(tipo === "hacking" ? "Hacking modificato!" : "Pattugliamento modificato!")
            .setDescription("Questo report è stato modificato e aggiornato nel database.")
            .addFields(
                {name: "Data operazione", value: dataOperazione, inline: true},
                {name: "Presenze", value: presenzeFinali},
                {name: "Alto Comando", value: altoComandoFinale},
                {name: "Coordinatori", value: coordinatoriFinali},
                {name: "Esito", value: esitoFinale.charAt(0).toUpperCase() + esitoFinale.slice(1)},
                {name: "Arresti", value: arrestiFinale !== null ? String(arrestiFinale) : "//"},
                {name: "Refurtiva", value: refurtivaFinale || "//"},
                {name: "ID Globale", value: idGlobale, inline: true}
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({
                text: `Bot CCU • Modificato da ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

            if (immagineFinale) {
                embed.setImage(immagineFinale);
            }

            if (cartellino.channel_id && cartellino.message_id) {
                const canale = await interaction.client.channels.fetch(cartellino.channel_id);

                if (canale && canale.isTextBased()) {
                    const messaggioOriginale = await canale.messages.fetch(cartellino.message_id);

                    await messaggioOriginale.edit({
                        embeds: [embed],
                    });
                }
            }

            await interaction.editReply({
                content: `Cartellino ${idGlobale} modificato correttamente. Anche l'embed originale è stato aggiornato.`,
            });
        } catch (error) {
            console.error("Errore comando /editcartellino:", error);

            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Errore rollback:", rollbackError);
                }
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "C'è stato un errore durante la modifica del cartellino.",
                });
            } else {
                await interaction.reply({
                    content: "C'è stato un errore durante la modifica del cartellino.",
                    ephemeral: true,
                });
            }
        } finally {
            if (connection) {
                connection.release();
            }
        }
    },
};
