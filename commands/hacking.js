const {SlashCommandBuilder, EmbedBuilder} = require("discord.js");

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
        try {
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

            const embed = new EmbedBuilder()
            .setColor(0x1f3c88)
            .setAuthor({
                name: "CCU - Report Hacking",
                iconURL: interaction.client.user.displayAvatarURL(),
            })
            .setTitle("Nuovo Hacking!")
            .setDescription("Un nuovo report hacking è stato effettuato.")
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

            await interaction.reply({
                embeds: [embed],
            });

            console.log("Data per database:", dataPerDatabase);
            console.log("Archivio channel ID:", archivioChannelId);
            console.log("Archivio message ID:", archivioMessageId);
            console.log("Archivio image URL:", archivioImageUrl);

            // Qui dopo salverai nel database:
            // dataPerDatabase
            // archivioChannelId
            // archivioMessageId
            // archivioImageUrl
        } catch (error) {
            console.error("Errore comando /hacking:", error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "C'è stato un errore durante la creazione del report.",
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: "C'è stato un errore durante la creazione del report.",
                    ephemeral: true,
                });
            }
        }
    },
};
