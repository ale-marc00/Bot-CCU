const {SlashCommandBuilder} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder().setName("oslo").setDescription("Risponde con Merda!"),

    async execute(interaction) {
        await interaction.reply("Aura");
    },
};
