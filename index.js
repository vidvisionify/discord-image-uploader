import { Client, GatewayIntentBits } from "discord.js";
import { Octokit } from "@octokit/rest";
import sharp from "sharp";
import fetch from "node-fetch";
import dotenv from "dotenv";
import * as chrono from "chrono-node";

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

/* ---------------------------------------------------------
   🔍 Natural-Language + MM-DD-YY Date Parser
--------------------------------------------------------- */
function parseKillDate(text) {
  if (!text) return null;

  // 1️⃣ Try natural-language with chrono
  const chronoResult = chrono.parseDate(text);
  if (chronoResult) {
    chronoResult.setHours(23, 59, 59, 999); // normalize to end-of-day
    return chronoResult;
  }

  // 2️⃣ Fallback to MM-DD-YY or MM/DD/YY
  const match = text.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (!match) return null;

  let [_, m, d, y] = match;
  if (y.length === 2) y = "20" + y;

  const manualDate = new Date(`${y}-${m}-${d}T23:59:59`);
  return isNaN(manualDate.getTime()) ? null : manualDate;
}

/* ---------------------------------------------------------
   📁 Kill-Date Metadata Load/Save
--------------------------------------------------------- */
async function loadKillData() {
  try {
    const res = await octokit.rest.repos.getContent({
      owner, repo, path: "uploads/killdates.json", ref: branch
    });

    if (!("content" in res.data)) return {};
    const json = Buffer.from(res.data.content, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return {}; // no file yet
  }
}

async function saveKillData(data) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString("base64");
  return safeUpdateFile("uploads/killdates.json", content, "Update killdate metadata");
}

/* ---------------------------------------------------------
   🔐 GitHub Helpers
--------------------------------------------------------- */
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
    console.warn(`⚠️ Could not get SHA for ${path}: ${err.message}`);
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
      console.warn(`⚠️ Retry updating ${path}: ${err.message}`);
      return safeUpdateFile(path, content, commitMsg, retries - 1);
    }
    console.error(`❌ Failed to update ${path}: ${err.message}`);
    return false;
  }
}

/* ---------------------------------------------------------
   🔁 Version Rotation
--------------------------------------------------------- */
async function rotatePosters() {
  const maxVersions = 3;

  for (let i = maxVersions; i >= 0; i--) {
    const src = i === 0 ? mainFileName : mainFileName.replace(".png", `-${i}.png`);
    const dest = mainFileName.replace(".png", `-${i + 1}.png`);

    if (i === maxVersions) {
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

/* ---------------------------------------------------------
   💀 Kill-Date Reaper (runs every minute)
--------------------------------------------------------- */
async function runReaper() {
  try {
    const data = await loadKillData();
    const now = new Date();

    for (const [filename, killDate] of Object.entries(data)) {
      const expires = new Date(killDate);

      if (now > expires) {
        console.log(`💀 ${filename} expired → replacing with generic.png`);

        const generic = await octokit.rest.repos.getContent({
          owner, repo, path: "uploads/generic.png", ref: branch
        });

        const base64 = generic.data.content;

        await safeUpdateFile(
          `uploads/${filename}`,
          base64,
          `Expire ${filename} and replace with generic.png`
        );

        delete data[filename];
        await saveKillData(data);
      }
    }
  } catch (err) {
    console.error("Reaper error:", err);
  }
}

/* ---------------------------------------------------------
   🚀 Startup
--------------------------------------------------------- */
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // run kill-date sweeper every minute
  setInterval(runReaper, 60 * 1000);
});

/* ---------------------------------------------------------
   📥 Image Upload Handler
--------------------------------------------------------- */
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

    const killDate = parseKillDate(message.content);
    const killData = await loadKillData();

    // Rotate old versions
    await rotatePosters();

    // Replace main poster
    const updated = await safeUpdateFile(
      `uploads/${mainFileName}`,
      base64Content,
      commitMsg
    );

    if (updated) {
      console.log(`✅ Updated ${mainFileName}`);
      await message.react("🔗");

      if (killDate) {
        killData[mainFileName] = killDate.toISOString();
        await saveKillData(killData);
        console.log(`⏳ ${mainFileName} will expire on ${killDate}`);
      }
    }

    // Save timestamped version for history
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `uploads/${mainFileName.replace(".png", `-${timestamp}.png`)}`;

    await safeUpdateFile(name, base64Content, commitMsg);

  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
});

client.login(process.env.DISCORD_TOKEN);
