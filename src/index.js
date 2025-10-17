import { Client, GatewayIntentBits } from "discord.js";
import { Octokit } from "@octokit/rest";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const {
  DISCORD_CHANNEL_ID,
  GITHUB_REPO,
  GITHUB_BRANCH = "main",
  GITHUB_PATH = "uploads/",
  IMAGE_FILENAME_BASE = "poster",
} = process.env;

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.channel.id !== DISCORD_CHANNEL_ID) return;
  const attachment = message.attachments.first();
  if (!attachment || !attachment.contentType?.startsWith("image/")) return;

  console.log(`🖼️ Found image in #${message.channel.name}: ${attachment.url}`);
  try {
    const res = await fetch(attachment.url);
    const buffer = Buffer.from(await res.arrayBuffer());

    // Resize image
    const resizedBuffer = await sharp(buffer)
      .resize(1024, 1024, { fit: "contain", background: "#00000000" })
      .png()
      .toBuffer();

    const timestamp = new Date().toISOString().replace(/[:.-]/g, "_");
    const baseFile = `${IMAGE_FILENAME_BASE}.png`;
    const timestampedFile = `${IMAGE_FILENAME_BASE}_${timestamp}.png`;

    const files = [
      { name: baseFile, buffer: resizedBuffer },
      { name: timestampedFile, buffer: resizedBuffer },
    ];

    for (const { name, buffer } of files) {
      const { data: repoData } = await octokit.repos.getContent({
        owner: GITHUB_REPO.split("/")[0],
        repo: GITHUB_REPO.split("/")[1],
        path: `${GITHUB_PATH}${name}`,
        ref: GITHUB_BRANCH,
      }).catch(() => ({ data: null }));

      const sha = repoData?.sha;

      await octokit.repos.createOrUpdateFileContents({
        owner: GITHUB_REPO.split("/")[0],
        repo: GITHUB_REPO.split("/")[1],
        path: `${GITHUB_PATH}${name}`,
        message: message.content || "New image upload",
        content: buffer.toString("base64"),
        branch: GITHUB_BRANCH,
        sha,
      });

      console.log(`✅ Uploaded ${name} to GitHub`);
    }

    // Update gallery.html
    const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_PATH}${timestampedFile}`;
    const altText = message.content || "Uploaded image";
    const galleryPath = path.resolve("gallery.html");

    let gallery = fs.existsSync(galleryPath) ? fs.readFileSync(galleryPath, "utf8") : "";
    const newEntry = `<figure><img src="${imageUrl}" alt="${altText}"><figcaption>${altText}</figcaption></figure>`;
    gallery = gallery.replace("</body>", `${newEntry}\n</body>`);
    fs.writeFileSync(galleryPath, gallery);

    console.log(`🖼️ Added to gallery.html: ${timestampedFile}`);

  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
