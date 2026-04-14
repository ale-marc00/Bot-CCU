const {SlashCommandBuilder} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder().setName("oslo").setDescription("Risponde con Aura!"),

    async execute(interaction) {
        await interaction.reply("Aura");
    },
};
