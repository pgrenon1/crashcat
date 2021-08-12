'use strict';
require('dotenv').config();
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

const wishlistPath = './wishlist.json';
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
    console.log(`Logged in as ${client.user.tag}!`);
    schedule.scheduleJob('0 12 * * *', () => { checkWishlists(); });
});

client.on('message', msg =>
{
    if (msg.author.id == client.user.id || !msg.content.startsWith(prefix) || msg.author.bot)
        return;

    console.log(`COMMAND RECEIVED : ${msg.content}`);

    let msgContent = msg.content;

    const stringParams = msgContent.match(/"(.*?)"/);
    let stringParam = "";
    if (stringParams)
    {
        stringParam = stringParams ? stringParams[1] : "";
        console.log(stringParam);
        msgContent = msgContent.replace(stringParam, "");
    }

    const args = msgContent.slice(prefix.length).trim().split(' ');
    console.log(`ARGUMENTS : ${args}`);

    const command = args[0];

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

async function checkWishlists()
{
    const wishlists = await asyncJsonReader(wishlistPath);
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
}

async function readWishlist(msg, guild)
{
    let wishlist = await asyncJsonReader(wishlistPath);
    if (wishlist[guild])
    {
        let content = "\n";
        let i = 1;
        for (let [appName, appEntry] of Object.entries(wishlist[guild]))
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
            postRandomUrlFromSubreddit('doggos', msg);
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
        case "snek":
            msg.reply("crashsnek is deprecated, please use crashs lol but here is your snek anyway :)");
            postRandomUrlFromSubreddit('sneks', msg);
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
            let wishlist = await asyncJsonReader(wishlistPath);

            if (!wishlist[guild])
                wishlist[guild] = {};

            appEntry["discount"] = percent;

            appEntry["last_announcement"] = 100;

            wishlist[guild][appName] = appEntry;

            wishlist = updateWishlistChannel(wishlist, guild, msg.channel);

            writeWishlist(wishlist);

            msg.channel.send("Added to wishlist " + guild.name + ": " + appName + " at <" + percent + "%");
        }
    }
}

async function removeFromWishlist(msg, guild, appName)
{
    let wishlist = await asyncJsonReader(wishlistPath);

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
