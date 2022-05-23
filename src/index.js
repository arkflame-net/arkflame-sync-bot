import dotenv from "dotenv";
import discord from "discord.js";
import ytdl from "ytdl-core";
import { createClient } from 'redis';
import mongoose from "mongoose";
import Video from "./video";

dotenv.config();

const usernameRegex = new RegExp("^[a-zA-Z0-9_]{2,16}$");
const Intents = discord.Intents;
const client = new discord.Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

mongoose.connect("mongodb://localhost/database");

const redis = createClient({
    url: 'redis://localhost/0'
});

redis.on('error', (err) => console.log('Redis Client Error', err));

redis.connect();

client.on("ready", () => {
    console.log("Ready!");
});

async function reply(message, text) {
    message.reply(text).catch((error) => { message.channel.send(text).catch((error) => { }) });
}

async function replyRequisites(message) {
    reply(message, "• Debe contener el `nombre del server` en el titulo.\n• Debe contener la `IP` en la descripcion.\n• Debe durar mas de `2 minutos`.\n• Debe tener menos de `7 dias` de antiguedad.\n• Debe ser unicamente en `ArkFlame`.\n• Debe tener la categoria `Gaming`.\n• Debe ser un video `publico`.")
}

client.on("messageCreate", async (message) => {
    if (message.author.bot) {
        return;
    }

    const channel = message.channel;

    if (channel.id == "452666709946400768") {
        const content = message.content;

        if (content != null) {
            if (content.startsWith("https://")) {
                try {
                    const info = await ytdl.getBasicInfo(content);
                    const videoDetails = info.videoDetails;
                    const title = videoDetails.title;
                    const description = videoDetails.description;
                    const videoId = videoDetails.videoId;
                    const duration = videoDetails.lengthSeconds;
                    const lowerDescription = description.toLowerCase();

                    let storedVideo = await Video.findOne({ videoId });

                    if (storedVideo != null) {
                        const member = message.guild.members.cache.get(storedVideo.discordId);
                        const registererName = member ? member.user.tag : "Desconocido";

                        reply(message, "El video ya fue registrado bajo el nick `" + storedVideo.nickname + "` por el usuario de Discord `" + registererName + "`");
                        return;
                    }

                    if (!videoDetails.isUnlisted) {
                        if (title.toLowerCase().includes("arkflame")) {
                            if (lowerDescription.includes("arkflame.com")) {
                                if (duration > 120) {
                                    if (videoDetails.category == "Gaming") {
                                        const publishDate = videoDetails.publishDate.split("-");
                                        const date = new Date();
                                        date.setFullYear(parseInt(publishDate[0]));
                                        date.setMonth(parseInt(publishDate[1]));
                                        date.setDate(parseInt(publishDate[2]));
                                        const timeDiff = Date.now() - date.getTime();

                                        if (timeDiff < (1000 * 60 * 60 * 24 * 7)) {
                                            if (lowerDescription.includes("nick:")) {
                                                const nickLower = lowerDescription.split("nick:")[1]?.trim().split(" ")[0].split("\n")[0];
                                                const nickLowerIndex = lowerDescription.indexOf(nickLower);
                                                const nick = description.substring(nickLowerIndex, nickLowerIndex + nickLower.length);

                                                if (!usernameRegex.test(nick)) {
                                                    reply(message, "El nickname que contiene el video es invalido!");
                                                    return;
                                                }

                                                /**
                                                 * MongoDB
                                                 */
                                                storedVideo = new Video();
                                                storedVideo.videoId = videoId;
                                                storedVideo.discordId = message.author.id;
                                                storedVideo.nickname = nick;
                                                await storedVideo.save();

                                                /**
                                                 * Redis
                                                 */
                                                redis.publish("arkflame-sync-yt", nick);

                                                reply(message, "Entregando rango `YouTube` al jugador " + nick + ". `(7 Dias)`");
                                            } else {
                                                reply(message, "El video debe incluir tu nick en la descripcion siguiendo el formato `nick: TuNick`.");
                                            }
                                        } else {
                                            replyRequisites(message);
                                            reply(message, "El video debe tener menos de `7 dias` de antiguedad.")
                                        }
                                    } else {
                                        replyRequisites(message);
                                        reply(message, "El video debe tener la categoria `Gaming`.")
                                    }
                                } else {
                                    replyRequisites(message);
                                    reply(message, "La duracion del video debe ser mayor a 2 minutos.")
                                }
                            } else {
                                replyRequisites(message);
                                reply(message, "La description no contiene la IP `arkflame.com`.");
                            }
                        } else {
                            replyRequisites(message);
                            reply(message, "El titulo no contiene el nombre del servidor `ArkFlame`.")
                        }
                    } else {
                        replyRequisites(message);
                        reply(message, "El video debe estar declarado como `publico`.");
                    }
                } catch (exception) {
                    reply(message, "Error al procesar el mensaje (No es un link de youtube?).");
                }
            } else {
                reply(message, "Debes ingresar un link al video de youtube!");
            }
        } else {
            reply(message, "El contenido ingresado no es valido!")
        }
    }
});

client.login(process.env["DISCORD_TOKEN"]);

