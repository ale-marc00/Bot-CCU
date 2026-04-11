const {SlashCommandBuilder, EmbedBuilder} = require("discord.js");

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

        const embed = new EmbedBuilder()
        .setColor(0x1f3c88)
        .setAuthor({
            name: "CCU - Report Hacking",
            iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle("Nuovo Pattugliamento!")
        .setDescription("Un nuovo report pattugliamento è stato effettuato.")
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

        if (refurtivaimg) {
            embed.setImage(refurtivaimg.url);
        }

        await interaction.reply({
            embeds: [embed],
        });

        console.log("Data per database:", dataPerDatabase);
    },
};
