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

function generaIdGlobale() {
    const lettere = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let codice = "";

    for (let i = 0; i < 5; i++) {
        codice += lettere.charAt(Math.floor(Math.random() * lettere.length));
    }

    return codice;
}

async function generaIdGlobaleUnico(connection) {
    let idGlobale;
    let esiste = true;

    while (esiste) {
        idGlobale = generaIdGlobale();

        const [rows] = await connection.execute(
            `
            SELECT id_globale FROM hacking WHERE id_globale = ?
            UNION
            SELECT id_globale FROM pattugliamenti WHERE id_globale = ?
            `,
            [idGlobale, idGlobale]
        );

        esiste = rows.length > 0;
    }

    return idGlobale;
}

module.exports = {
    data: new SlashCommandBuilder()
    .setName("pattugliamento")
    .setDescription("Compila il report pattugliamento CCU")

    .addStringOption((option) =>
        option.setName("presenze").setDescription("Inserisci i nomi o tag delle presenze").setRequired(true)
    )

    .addStringOption((option) =>
        option.setName("coordinatori").setDescription("Inserisci i coordinatori").setRequired(true)
    )

    .addStringOption((option) =>
        option
        .setName("esito")
        .setDescription("Seleziona l'esito dell'operazione")
        .setRequired(true)
        .addChoices({name: "Positivo", value: "positivo"}, {name: "Negativo", value: "negativo"})
    )

    .addStringOption((option) =>
        option.setName("altocomando").setDescription("Inserisci l'alto comando").setRequired(false)
    )

    .addIntegerOption((option) => option.setName("arresti").setDescription("Numero di arresti").setRequired(false))

    .addStringOption((option) =>
        option.setName("refurtiva").setDescription("Descrizione della refurtiva").setRequired(false)
    )

    .addAttachmentOption((option) =>
        option.setName("refurtiva-img").setDescription("Allega l'immagine della refurtiva").setRequired(false)
    ),

    async execute(interaction) {
        let connection;

        try {
            await interaction.deferReply();

            const presenze = interaction.options.getString("presenze");
            const coordinatori = interaction.options.getString("coordinatori");
            const esito = interaction.options.getString("esito");
            const altoComando = interaction.options.getString("altocomando");
            const arresti = interaction.options.getInteger("arresti");
            const refurtiva = interaction.options.getString("refurtiva");
            const refurtivaimg = interaction.options.getAttachment("refurtiva-img");

            const dataOperazione = new Date();
            const dataFormattata = dataOperazione.toLocaleString("it-IT");
            const dataPerDatabase = dataOperazione.toISOString().slice(0, 19).replace("T", " ");

            const inizioGiornata = new Date();
            inizioGiornata.setHours(0, 0, 0, 0);

            const fineGiornata = new Date();
            fineGiornata.setHours(23, 59, 59, 999);

            const inizioGiornataDB = inizioGiornata.toISOString().slice(0, 19).replace("T", " ");
            const fineGiornataDB = fineGiornata.toISOString().slice(0, 19).replace("T", " ");

            if (esito === "positivo" && arresti === null) {
                return await interaction.editReply({
                    content: "Se l'esito è positivo, devi inserire il numero di arresti.",
                });
            }

            if (esito === "positivo" && !refurtiva) {
                return await interaction.editReply({
                    content: "Se l'esito è positivo, devi inserire la refurtiva.",
                });
            }

            if (esito === "positivo" && !refurtivaimg) {
                return await interaction.editReply({
                    content: "Se l'esito è positivo, devi allegare l'immagine della refurtiva.",
                });
            }

            connection = await pool.getConnection();

            const idGlobale = await generaIdGlobaleUnico(connection);

            const [rows] = await connection.execute(
                `SELECT COUNT(*) AS totale
                 FROM pattugliamenti
                 WHERE created_at BETWEEN ? AND ?`,
                [inizioGiornataDB, fineGiornataDB]
            );

            const totaleOggi = rows[0].totale;

            if (totaleOggi >= 2) {
                return await interaction.editReply({
                    content: "Oggi il comando /pattugliamento ha già raggiunto il limite massimo di 2 utilizzi.",
                });
            }

            let archivioChannelId = null;
            let archivioMessageId = null;
            let archivioImageUrl = null;

            if (refurtivaimg) {
                const archivioChannel = await interaction.client.channels.fetch(
                    process.env.ARCHIVIO_REFURTIVA_CHANNEL_ID
                );

                if (!archivioChannel || !archivioChannel.isTextBased()) {
                    return await interaction.editReply({
                        content: "Il canale archivio refurtiva non è valido o non è accessibile.",
                    });
                }

                const messaggioArchivio = await archivioChannel.send({
                    content:
                        `📦 Archivio Refurtiva CCU\n` +
                        `ID Globale: ${idGlobale}\n` +
                        `Richiesto da: ${interaction.user.tag}\n` +
                        `Utente ID: ${interaction.user.id}\n` +
                        `Data: ${dataFormattata}\n` +
                        `Esito: ${esito}`,
                    files: [
                        {
                            attachment: refurtivaimg.url,
                            name: refurtivaimg.name || "refurtiva.png",
                        },
                    ],
                });

                const allegatoArchivio = messaggioArchivio.attachments.first();

                archivioChannelId = messaggioArchivio.channel.id;
                archivioMessageId = messaggioArchivio.id;
                archivioImageUrl = allegatoArchivio ? allegatoArchivio.url : null;
            }

            const idsPresenze = estraiIdsDiscord(presenze);
            const idsCoordinatori = estraiIdsDiscord(coordinatori);
            const idsAltoComando = estraiIdsDiscord(altoComando);

            const partecipantiPresenze = await creaPartecipantiDaIds(interaction.guild, idsPresenze, "presenza");
            const partecipantiCoordinatori = await creaPartecipantiDaIds(
                interaction.guild,
                idsCoordinatori,
                "coordinatore"
            );
            const partecipantiAltoComando = await creaPartecipantiDaIds(
                interaction.guild,
                idsAltoComando,
                "altocomando"
            );

            const tuttiPartecipanti = [
                ...partecipantiPresenze,
                ...partecipantiCoordinatori,
                ...partecipantiAltoComando,
            ];

            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO pattugliamenti (
                    id_globale,
                    autore_discord_id,
                    autore_discord_username,
                    esito,
                    arresti,
                    refurtiva,
                    refurtiva_img_url,
                    archivio_channel_id,
                    archivio_message_id,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    idGlobale,
                    interaction.user.id,
                    interaction.user.username,
                    esito,
                    arresti,
                    refurtiva,
                    archivioImageUrl,
                    archivioChannelId,
                    archivioMessageId,
                    dataPerDatabase,
                ]
            );

            const pattugliamentiId = result.insertId;

            for (const partecipante of tuttiPartecipanti) {
                await connection.execute(
                    `INSERT INTO pattugliamenti_partecipanti (
                        pattugliamenti_id,
                        discord_id,
                        discord_username,
                        ruolo
                    ) VALUES (?, ?, ?, ?)`,
                    [pattugliamentiId, partecipante.discord_id, partecipante.discord_username, partecipante.ruolo]
                );
            }

            await connection.commit();

            const embed = new EmbedBuilder()
            .setColor(0x1f3c88)
            .setAuthor({
                name: "CCU - Report Pattugliamento",
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .setTitle("Nuovo Pattugliamento!")
            .setDescription("Un nuovo report pattugliamento è stato effettuato e salvato nel database.")
            .addFields(
                {
                    name: "Data operazione",
                    value: dataFormattata,
                    inline: true,
                },
                {
                    name: "Presenze",
                    value: presenze,
                },
                {
                    name: "Alto Comando",
                    value: altoComando || "//",
                },
                {
                    name: "Coordinatori",
                    value: coordinatori,
                },
                {
                    name: "Esito",
                    value: esito.charAt(0).toUpperCase() + esito.slice(1),
                    inline: false,
                },
                {
                    name: "Arresti",
                    value: arresti !== null ? String(arresti) : "//",
                    inline: false,
                },
                {
                    name: "Refurtiva",
                    value: refurtiva || "//",
                },
                {
                    name: "ID Globale",
                    value: idGlobale,
                    inline: true,
                }
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({
                text: `Bot CCU • Richiesto da ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

            if (archivioImageUrl) {
                embed.setImage(archivioImageUrl);
            }

            const messaggioReport = await interaction.editReply({
                embeds: [embed],
            });

            await connection.execute(
                `
                UPDATE pattugliamenti
                SET channel_id = ?,
                    message_id = ?
                WHERE id = ?
                `,
                [messaggioReport.channel.id, messaggioReport.id, pattugliamentiId]
            );

            console.log("ID Globale:", idGlobale);
            console.log("Data per database:", dataPerDatabase);
            console.log("Archivio channel ID:", archivioChannelId);
            console.log("Archivio message ID:", archivioMessageId);
            console.log("Archivio image URL:", archivioImageUrl);
            console.log("ID report salvato:", pattugliamentiId);
        } catch (error) {
            console.error("Errore comando /pattugliamento:", error);

            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error("Errore rollback:", rollbackError);
                }
            }

            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({
                    content: "C'è stato un errore durante la creazione del report.",
                    embeds: [],
                });
            } else {
                await interaction.reply({
                    content: "C'è stato un errore durante la creazione del report.",
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
