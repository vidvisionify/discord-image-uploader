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

async function getLatestSha(path) {
  try {
    const branchInfo = await octokit.rest.repos.getBranch({ owner, repo, branch });
    const commitSha = branchInfo.data.commit.sha;

    const tree = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: commitSha,
      recursive: true,
    });

    const file = tree.data.tree.find(f => f.path === path);
    return file?.sha;
  } catch (err) {
    console.warn(`⚠️ Could not get SHA for ${path}:`, err.message);
    return undefined;
  }
}

async function safeUpdateFile(path, content, commitMsg, retries = 1) {
  try {
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
    return true;
  } catch (err) {
    if (retries > 0) {
      console.warn(`⚠️ Retry updating ${path} due to error: ${err.message}`);
      return safeUpdateFile(path, content, commitMsg, retries - 1);
    }
    console.error(`❌ Failed to update ${path}:`, err.message);
    return false;
  }
}

async function rotatePosters() {
  const maxVersions = 3;
  for (let i = maxVersions; i >= 0; i--) {
    const src = i === 0 ? mainFileName : mainFileName.replace(".png", `-${i}.png`);
    const dest = mainFileName.replace(".png", `-${i + 1}.png`);
    if (i === maxVersions) {
      // Delete the oldest version if it exists
      try {
        const sha = await getLatestSha(`uploads/${dest}`);
        if (sha) {
          await octokit.rest.repos.deleteFile({
            owner,
            repo,
            path: `uploads/${dest}`,
            message: `Remove old version ${dest}`,
            sha,
            branch,
          });
          console.log(`🗑️ Removed oldest ${dest}`);
        }
      } catch {}
      continue;
    }

    const sha = await getLatestSha(`uploads/${src}`);
    if (!sha) continue;

    const file = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `uploads/${src}`,
      ref: branch,
    });

    if (!("content" in file.data)) continue;
    const content = file.data.content;

    await safeUpdateFile(`uploads/${dest}`, content, `Rotate ${src} → ${dest}`);
    console.log(`🔁 Rotated ${src} → ${dest}`);
  }
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

    // Rotate previous poster versions
    await rotatePosters();

    // Replace main poster.png
    const mainReplaced = await safeUpdateFile(
      `uploads/${mainFileName}`,
      base64Content,
      commitMsg
    );

    if (mainReplaced) {
      console.log(`✅ Replaced ${mainFileName}`);
      await message.react("🔗");
    }

    // Timestamped version for archive
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const timestampedName = `uploads/${mainFileName.replace(
      /\.png$/,
      `-${timestamp}.png`
    )}`;
    await safeUpdateFile(timestampedName, base64Content, commitMsg);
  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
