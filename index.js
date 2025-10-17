import { Client, GatewayIntentBits } from "discord.js";
import { Octokit } from "@octokit/rest";
import sharp from "sharp";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const [owner, repo] = process.env.GITHUB_REPO.split("/");
const channelId = process.env.DISCORD_CHANNEL_ID;
const mainFileName = process.env.MAIN_FILENAME || "poster.png";
const branch = process.env.GITHUB_BRANCH || "main";

// Fetch the SHA of the file from the latest branch tree
async function getLatestSha(path) {
  const branchInfo = await octokit.rest.repos.getBranch({ owner, repo, branch });
  const commitSha = branchInfo.data.commit.sha;

  const tree = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commitSha,
    recursive: true,
  });

  const file = tree.data.tree.find(f => f.path === path);
  return file?.sha; // undefined if file doesn't exist yet
}

// Helper to safely update a file
async function safeUpdateFile(path, content, commitMsg) {
  const sha = await getLatestSha(path);
  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message: commitMsg,
    content,
    sha,
    branch,
  });
}

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
    const res = await fetch(attachment.url);
    const buffer = Buffer.from(await res.arrayBuffer());

    const resized = await sharp(buffer)
      .resize(1024, 1024, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const base64Content = resized.toString("base64");
    const commitMsg = message.content || `Upload ${mainFileName}`;

    // ---- Replace poster.png ----
    await safeUpdateFile(`uploads/${mainFileName}`, base64Content, commitMsg);
    console.log(`✅ Replaced ${mainFileName}`);

    // ---- Upload timestamped copy ----
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const timestampedName = `uploads/${mainFileName.replace(
      /\.png$/,
      `-${timestamp}.png`
    )}`;
    await safeUpdateFile(timestampedName, base64Content, commitMsg);
    console.log(`✅ Uploaded timestamped file: ${timestampedName}`);

    // ---- React to original message ----
    await message.react("🔗");
  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
