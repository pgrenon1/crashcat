require('dotenv').config();
const fetch = require("node-fetch");
const { Client, MessageAttachment } = require('discord.js');

'use strict';
const snoowrap = require('snoowrap');
const r = new snoowrap({
  userAgent: process.env.REDDITUSERAGENT,
  clientId: process.env.REDDITCLIENTID,
  clientSecret: process.env.REDDITSECRET,
  refreshToken: process.env.REDDITREFRESH
});

async function postRandomUrlFromSubreddit(sub, msg) {
  var post = await r.getSubreddit(sub).getRandomSubmission()
  msg.channel.send(post.url);
}

async function complimentAsync (url, msg, target) {
  let response = await fetch(url);
  let data = await response.json();

  let compliment = data['compliment']
  msg.channel.send("<@" + target + ">, " + compliment);
}

const client = new Client();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
  if (msg.author.id != client.user.id) {
    if (msg.content.match(/(^|\W)-crashc(\W|$)/gi)) {
      postRandomUrlFromSubreddit('kittens', msg);
      return;
    }
    else if (msg.content.match(/(^|\W)-crashd(\W|$)/gi)) {
      postRandomUrlFromSubreddit('doggos', msg);
      return;
    }
    else if (msg.content.match(/(^|\W)-😘(\W|$)/gi)){
      let targetMembers = msg.mentions.members;
      if (targetMembers.size > 0){
        targetMembers.forEach(target => {
          complimentAsync('https://complimentr.com/api', msg, target)
        });
      }
      else{
        complimentAsync('https://complimentr.com/api', msg, msg.author)
      }
    }
  }
});

client.login(process.env.DISCORDTOKEN);
