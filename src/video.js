import { Schema, model } from "mongoose";

export default model("videos", new Schema({
    videoId: String,
    discordId: String,
    nickname: String,
}));