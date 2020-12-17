require('dotenv').config();
const { Client, MessageAttachment } = require('discord.js');
const config = require('./config.json');

const client = new Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.author.id != client.user.id) {
    if (msg.content.match(/(^|\W)-crash(\W|$)/gi)) {
      msg.channel.send("test");
      return;
    }
  }
});

client.login(process.env.TOKEN);
