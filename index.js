import { Client, GatewayIntentBits } from "discord.js";
import { Octokit } from "@octokit/rest";
import fs from "fs";
import sharp from "sharp";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const owner = process.env.GITHUB_REPO.split("/")[0];
const repo = process.env.GITHUB_REPO.split("/")[1];
const channelId = process.env.DISCORD_CHANNEL_ID;
const mainFileName = process.env.MAIN_FILENAME || "poster.png";

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.channel.id !== channelId) return;
  if (message.author.bot) return;

  const attachment = message.attachments.first();
  if (!attachment || !attachment.contentType?.startsWith("image/")) return;

  console.log(`🖼️ Found image: ${attachment.url}`);

  try {
    // Download the image
    const res = await fetch(attachment.url);
    const buffer = Buffer.from(await res.arrayBuffer());

    // Resize to 1024x1024 square PNG
    const resized = await sharp(buffer)
      .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const base64Content = resized.toString("base64");

    // Upload/replace main file
    let sha;
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path: `uploads/${mainFileName}` });
      sha = data.sha;
    } catch (err) {
      if (err.status !== 404) throw err; // ignore if file doesn't exist
    }

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `uploads/${mainFileName}`,
      message: message.content || `Upload ${mainFileName}`,
      content: base64Content,
      sha,
    });

    console.log(`✅ Replaced ${mainFileName}`);

    // Upload timestamped version
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const timestampedName = `uploads/${mainFileName.replace(/(\.png)$/, `-${timestamp}$1`)}`;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: timestampedName,
      message: message.content || `Upload ${timestampedName}`,
      content: base64Content,
    });

    console.log(`✅ Uploaded timestamped file: ${timestampedName}`);
  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
