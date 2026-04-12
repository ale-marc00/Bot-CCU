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

module.exports = {
    data: new SlashCommandBuilder()
    .setName("hacking")
    .setDescription("Compila il report hacking CCU")

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

            if (esito === "positivo" && arresti === null) {
                return await interaction.reply({
                    content: "Se l'esito è positivo, devi inserire il numero di arresti.",
                    ephemeral: true,
                });
            }

            if (esito === "positivo" && !refurtiva) {
                return await interaction.reply({
                    content: "Se l'esito è positivo, devi inserire la refurtiva.",
                    ephemeral: true,
                });
            }

            if (esito === "positivo" && !refurtivaimg) {
                return await interaction.reply({
                    content: "Se l'esito è positivo, devi allegare l'immagine della refurtiva.",
                    ephemeral: true,
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
                    return await interaction.reply({
                        content: "Il canale archivio refurtiva non è valido o non è accessibile.",
                        ephemeral: true,
                    });
                }

                const messaggioArchivio = await archivioChannel.send({
                    content:
                        `📦 Archivio Refurtiva CCU\n` +
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

            connection = await pool.getConnection();
            await connection.beginTransaction();

            const [result] = await connection.execute(
                `INSERT INTO ccu (
                    autore_discord_id,
                    autore_discord_username,
                    esito,
                    arresti,
                    refurtiva,
                    refurtiva_img_url,
                    archivio_channel_id,
                    archivio_message_id,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
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

            const ccuId = result.insertId;

            for (const partecipante of tuttiPartecipanti) {
                await connection.execute(
                    `INSERT INTO CCU_partecipanti (
                        ccu_id,
                        discord_id,
                        discord_username,
                        ruolo
                    ) VALUES (?, ?, ?, ?)`,
                    [ccuId, partecipante.discord_id, partecipante.discord_username, partecipante.ruolo]
                );
            }

            await connection.commit();

            const embed = new EmbedBuilder()
            .setColor(0x1f3c88)
            .setAuthor({
                name: "CCU - Report Hacking",
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .setTitle("Nuovo Hacking!")
            .setDescription("Un nuovo report hacking è stato effettuato e salvato nel database.")
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

            await interaction.editReply({
                embeds: [embed],
            });

            console.log("Data per database:", dataPerDatabase);
            console.log("Archivio channel ID:", archivioChannelId);
            console.log("Archivio message ID:", archivioMessageId);
            console.log("Archivio image URL:", archivioImageUrl);
            console.log("ID report salvato:", ccuId);
        } catch (error) {
            console.error("Errore comando /hacking:", error);

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
