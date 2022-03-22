'use strict';
require('dotenv').config();
require(`discord-reply`);
const schedule = require('node-schedule');
const fetch = require("node-fetch");
const { Client, MessageAttachment, Message } = require('discord.js');
const express = require('express');
const app = express();
const randomChannelID = process.env.RANDOM_CHANNEL_ID;
const SteamAPI = require('steamapi');
const steam = new SteamAPI('61D686B6252F0A5ABC2673AB5B8D748B');
const util = require('util');
const asyncJsonReader = util.promisify(jsonReader);
const pollEmbed = require('discord.js-poll-embed');
const discordEmojiRegex = /(<a?)?:\w+:(\d{18}>)?/g;
const unicodeEmojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;

const dataPath = './data.json';
let data;
const prefix = `-`;
const crashCommand = "crash";
const complimentURL = 'https://complimentr.com/api';
const quoteURL = "https://zenquotes.io/api/random"

const fs = require('fs');
const readline = require('readline');
const readInterface = readline.createInterface({
    input: fs.createReadStream('.env'),
    output: process.stdout,
    console: false
});

app.listen(3000, function ()
{
    console.log('Webhook app listening on port 3000!');
});

const snoowrap = require('snoowrap');
const r = new snoowrap({
    userAgent: process.env.REDDITUSERAGENT,
    clientId: process.env.REDDITCLIENTID,
    clientSecret: process.env.REDDITSECRET,
    refreshToken: process.env.REDDITREFRESH
});

const client = new Client();

client.on('ready', () =>
{
    console.log(`\nLogged in as ${client.user.tag}!`);
    loadData();
    schedule.scheduleJob('0 12 * * *', () => { checkWishlists(); });
    schedule.scheduleJob('0 0 10 ? * * *', () => { pollIcon(); });
});

async function loadData()
{
    data = await asyncJsonReader(dataPath);
}

function setupChannel(guild, channelID)
{
    data.channels[guild] = channelID;
    writeData();
}

function pollIcon()
{

}

client.on('message', msg =>
{
    if (msg.author.id == client.user.id || !msg.content.startsWith(prefix))
        return;

    console.log(`COMMAND RECEIVED: ${msg.content}`);

    let msgContent = msg.content;

    const stringParams = msgContent.match(/"(.*?)"/);
    let stringParam = "";
    if (stringParams)
    {
        stringParam = stringParams ? stringParams[1] : "";
        console.log(stringParam);
        msgContent = msgContent.replace(stringParam, "");
    }

    const command = msgContent.slice(prefix.length).trim().split(' ')[0];
    console.log(`COMMAND TYPE: ${command[0]}`);

    const paramsString = msgContent.substring(msgContent.indexOf(' ')).trim().trimStart();
    console.log(`PARAMS STRING: ${paramsString}`);

    if (command.startsWith(crashCommand))
    {
        let crashSuffix = command.slice(crashCommand.length);
        replyCrash(crashSuffix, msg);
    }
    else if (command.startsWith("<:patpat:771373220351442966>"))
    {
        replyQuote(msg);
    }
    else if (command.startsWith("😘"))
    {
        replyCompliment(msg);
    }
    else if (command.startsWith("why"))
    {
        msg.channel.send("```TIL Research shows that viewing online Cat media(i.e.pictures and videos) is related to positive emotions.It may even work as a form of digital therapy or stress relief for some users.Some feelings of guilt from postponing tasks can also be reduced by viewing Cat content.``` https://www.reddit.com/r/todayilearned/comments/m0giw8/til_research_shows_that_viewing_online_cat_media/?utm_medium=android_app&utm_source=share");
    }
    else if (command.startsWith("setup"))
    {
        setupChannel(msg.guild.id, msg.channel.id);
        msg.channel.send(`\`\`\`Updated prefered channel: ${msg.channel.name}\`\`\``);
    }
    else if (command.startsWith("poll"))
    {
        if (!paramsString.includes(`?`))
        {
            msg.channel.send(`\`\`\`Bad format. Try something like : -poll What is your favorite food ? Pasta + Burgers + Pizza\`\`\``)
            return;
        }

        const question = paramsString.substring(0, paramsString.indexOf(`?`));
        console.log(`POLL QUESTION: ` + question);

        const afterQuestion = paramsString.substring(paramsString.indexOf(`?`) + 1).trim();

        const pollParams = afterQuestion.split(';');
        const pollOptions = pollParams[0].trim().split('+').map(item => item.replace('+', '').trim());
        console.log(`POLL OPTIONS(${pollOptions.length}): ` + pollOptions);

        let emojis = undefined;
        if (pollParams[1] != undefined)
            emojis = pollParams[1].trim().split(/[\s,]+/);
        else if (pollOptions.every(option => option.match(discordEmojiRegex) || option.match(unicodeEmojiRegex)))
            emojis = pollOptions.map(item => item.replace('+', '').trim());
        console.log(`EMOJIS(${emojis != undefined ? emojis.length : 0}): ` + emojis);

        let timeout = 0;
        if (pollParams[2] != undefined && isNumeric(pollParams))
            timeout =

                pollEmbed(msg, question, pollOptions, timeout, emojis, undefined);
    }
    else if (command.startsWith("wish") || command.startsWith("w"))
    {
        if (stringParam == "")
        {
            msg.channel.send("Invalid parameter: App Name");
            return;
        }

        let guild = msg.guild;
        let appName = stringParam;
        let discount = args[2];

        if (isNumeric(discount))
        {
            let percentValue = parseFloat(discount);
            addToWishlist(msg, guild, appName, percentValue);
            return;
        }

        addToWishlist(msg, guild, appName);
    }
    else if (command.startsWith("unwish") || command.startsWith("u"))
    {
        let guild = msg.guild;
        let appName = stringParam;

        removeFromWishlist(msg, guild, appName);
    }
    else if (command.startsWith("readwish") || command.startsWith("r"))
    {
        let guild = msg.guild;

        readWishlist(msg, guild);
    }
});

function pollCallback(msg, emojiInfo)
{
    let highestVoteCount = 0;
    let winner;
    const results = Object.values(emojiInfo);
    for (let i = 0; i < results.length; i++)
    {
        const result = results[i];
        if (result.votes > highestVoteCount)
        {
            highestVoteCount = result.votes;
            winner = result;
        }
    }

    if (winner == undefined) // zero votes
    {
        msg.lineReply("No one voted! Booooooo!");
        return;
    }

    let winners = [];
    results.forEach(result =>
    {
        if (result.votes == winner.votes)
            winners.push(result);
    });

    if (winners.length > 1) // exequo
    {
        let text = "Exequo between `"
        for (const exequoWinner of winners)
        {
            text += `${exequoWinner.option} `;
        }
        msg.lineReply(text);
        return;
    }

    msg.lineReply(`Poll Winner is ${winner.option}!`);
}

async function checkWishlists()
{
    const data = await asyncJsonReader(dataPath);
    const wishlists = data.wishlists;
    for (let [guild, wishlist] of Object.entries(wishlists))
    {
        let channel = wishlist.channel;
        for (let [appName, appEntry] of Object.entries(wishlists[guild]))
        {
            if (appName == "channel")
                continue;

            if (appEntry.hasOwnProperty('appid'))
            {
                let data = await steam.getGameDetails(appEntry.appid);
                let priceOverview = data.price_overview;
                if (priceOverview != null) 
                {
                    let currentDiscount = parseInt(priceOverview.discount_percent);
                    if (currentDiscount >= appEntry.discount && appEntry.last_announcement != currentDiscount)
                    {
                        let announcement = `Wishlisted item "${appEntry.name}" (<${appEntry.discount}%) is on sale! ${priceOverview.initial_formatted} => **${priceOverview.final_formatted}** (-${currentDiscount}%)`;
                        client.channels.cache.get(channel).send(announcement);

                        appEntry.last_announcement = currentDiscount;
                    }
                }
            }

            wishlists[guild][appName] = appEntry;
        }

    }

    writeWishlist(wishlists);
}

async function postRandomUrlFromSubreddit(sub, msg)
{
    let subreddit = await r.getSubreddit(sub);
    let post = await subreddit.getRandomSubmission();
    let url = post.url;
    if (!url)
    {
        url = post[5].url
    }
    console.log(url);

    msg.channel.send(post.url);

    msg.react("<:patpatunity:869975028421251082>");
}

async function readWishlist(msg, guild)
{
    let data = await asyncJsonReader(dataPath);
    let wishlists = data.wishlists;
    console.log(wishlists);
    if (wishlists[guild])
    {
        let content = "\n";
        let i = 1;
        for (let [appName, appEntry] of Object.entries(wishlists[guild]))
        {
            if (!appEntry.hasOwnProperty("appid"))
                continue;

            let price = "ERR";

            let data = await steam.getGameDetails(appEntry.appid);
            price = data.price_overview.final_formatted;
            let currentDiscount = data.price_overview.discount_percent;
            content += `${i}. ${appName} (<${appEntry.discount}%) : *${price}* ** (-${currentDiscount}%) **\n`;
            i++;
        }

        if (msg)
            msg.channel.send("Wishlist " + guild.name + ": " + content);
    }
}

async function replyCompliment(msg)
{
    let targetMembers = msg.mentions.members;

    if (targetMembers.size == 0)
        return;

    for (const target of targetMembers)
    {
        let response = await fetch(complimentURL);
        let data = await response.json();

        let compliment = data['compliment']
        msg.channel.send(target[1].toString() + ", " + compliment);
    }
}

async function replyQuote(msg)
{
    let targetMembers = msg.mentions.members;

    if (targetMembers.size == 0)
        return;

    for (const target of targetMembers)
    {
        let response = await fetch(quoteURL);
        let data = await response.json();

        let quoteResponse = data[0];
        msg.channel.send(target[1].toString() + ", " + quoteResponse["q"] + "- " + quoteResponse["a"]);
    }
}

async function replyCrash(crashSuffix, msg)
{
    console.log(`CRASH : ${crashSuffix}`);
    switch (crashSuffix)
    {
        case "c":
            postRandomUrlFromSubreddit('cutecats', msg);
            break;
        case "d":
            postRandomUrlFromSubreddit('rarepuppers', msg);
            break;
        case "a":
            postRandomUrlFromSubreddit('babyanimals', msg);
            break;
        case "dr":
            postRandomUrlFromSubreddit('BadAssDragons', msg);
            break;
        case "b":
            postRandomUrlFromSubreddit('birbs', msg);
            break;
        case "s":
            postRandomUrlFromSubreddit('sneks', msg);
            break;
        case "arch":
            postRandomUrlFromSubreddit('ModernistArchitecture', msg);
            break;
        case "u":
            postRandomUrlFromSubreddit('unicorns', msg);
            break;
        case "k":
            postRandomUrlFromSubreddit('mechanicalkeyboards', msg);
            break;
        default:
            break;
    }
}

async function addToWishlist(msg, guild, appName, percent = 100)
{
    var steamData = await steam.getAppList();
    for (let appEntry of steamData)
    {
        if (appEntry.name == appName)
        {
            let data = await asyncJsonReader(dataPath);

            let wishlists = data.wishlists;
            if (!wishlists[guild])
                wishlists[guild] = {};

            appEntry["discount"] = percent;

            appEntry["last_announcement"] = 100;

            wishlists[guild][appName] = appEntry;

            wishlists = updateWishlistChannel(wishlists, guild, msg.channel);

            writeWishlist(wishlists);

            msg.channel.send("Added to wishlist " + guild.name + ": " + appName + " at <" + percent + "%");
        }
    }
}

async function removeFromWishlist(msg, guild, appName)
{
    let wishlist = await asyncJsonReader(dataPath);

    delete wishlist[guild][appName];

    if (wishlist[guild] == {})
        delete wishlist[guild];

    wishlist = updateWishlistChannel(wishlist, guild, msg.channel);

    writeWishlist(wishlist);

    msg.channel.send("Removed from wishlist " + guild.name + ": " + appName);
}

function updateWishlistChannel(wishlist, guild, channel)
{
    wishlist[guild]["channel"] = channel.id;
    return wishlist;
}

function writeWishlist(wishlists)
{
    fs.writeFile('./wishlist.json', JSON.stringify(wishlists, null, 4), (err) =>
    {
        if (err)
            console.log('Error writing file:', err);
    });
}

function writeData()
{
    fs.writeFile('./data.json', JSON.stringify(data, null, 4), (err) =>
    {
        if (err)
            console.log('Error writing file:', err);
    });
}

function jsonReader(filePath, callback)
{
    fs.readFile(filePath, (err, fileData) =>
    {
        if (err)
        {
            return callback && callback(err)
        }
        try
        {
            const object = JSON.parse(fileData)
            return callback && callback(null, object)
        } catch (err)
        {
            return callback && callback(err)
        }
    })
}

function isNumeric(str)
{
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
        !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

client.login(process.env.DISCORDTOKEN);
