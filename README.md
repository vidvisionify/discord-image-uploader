# 🖼️ Discord → GitHub Image Uploader

### Host VRChat images directly from Discord uploads
This project automatically uploads images posted in a specific Discord channel to a GitHub repository — perfect for hosting textures, posters, or image assets that can be downloaded in VRChat (e.g., for use with Udon’s image downloader or dynamic texture systems).

Images are:
- Automatically resized to **1024×1024 PNG**    
- Uploaded to GitHub with **commit messages** taken from your Discord message text    
- Added to a simple **gallery.html** for easy viewing    
- Each commit message becomes the **alt text** for that image

### Attention: This script is made by AI.
I wasn't able to find a project to do exactly what I wanted, so I used ChatGPT instead of struggling for weeks.
While I would never use genAI to create images or video, I don't see (as much) harm in simple code like this. IDK, I might backpedal on this at some point, I'm a simple creature that can only handle so many ethics questions.

---
## 🚀 Features
- Monitors a single Discord channel for new images    
- Resizes and uploads them to GitHub automatically    
- Includes both the base image name and timestamped versions    
- Maintains an HTML gallery of uploaded images    
- Fully containerized with Docker
    

---
## 🧩 Setup Instructions
### 1. Create a Discord Bot
1. Go to the Discord Developer Portal    
2. Click **New Application**, name it something like `PosterBoaster`    
3. Go to **Bot → Add Bot**    
4. Under **Privileged Gateway Intents**, enable:    
    - ✅ Message Content Intent        
    - ✅ Server Members Intent (optional)        
5. Copy your **Bot Token** — you’ll need it for your `.env` file
    
#### Add the bot to your server
1. Under **OAuth2 → URL Generator**, select:    
    - **bot**        
    - **applications.commands**        
2. In **Bot Permissions**, enable:    
    - Read Messages / View Channels        
    - Send Messages        
    - Attach Files        
    - Embed Links        
3. Copy the generated invite URL and use it to add the bot to your server
    

---
### 2. Create a GitHub Personal Access Token
1. Go to [GitHub → Settings → Developer Settings → Fine-grained Tokens](https://github.com/settings/tokens)    
2. Click **Generate new token (classic)** or **fine-grained token**    
3. Give it:    
    - **Repository access**: The repo you want to upload to        
    - **Permissions**:        
        - _Contents → Read and Write_            
4. Copy your token — you’ll add it to the `.env` file    

---
### 3. Prepare Your Repository
- Create (or use) a GitHub repo that will store your images.    
- The bot will upload images to a folder (e.g., `/uploads/`) and maintain a `gallery.html` in the root directory.
---
### 4. Environment Variables
Create a `.env` file in the project root:

`DISCORD_TOKEN=your_discord_bot_token DISCORD_CHANNEL_ID=your_channel_id GITHUB_TOKEN=your_github_personal_access_token GITHUB_REPO=YourUsername/YourRepoName GITHUB_BRANCH=main IMAGE_FILENAME_BASE=poster GITHUB_PATH=uploads/`

---
### 5. Run with Docker Compose

`version: "3.9" services:   discord-image-uploader:     build: .     container_name: discord-image-uploader     restart: always     environment:       - DISCORD_TOKEN=${DISCORD_TOKEN}       - DISCORD_CHANNEL_ID=${DISCORD_CHANNEL_ID}       - GITHUB_TOKEN=${GITHUB_TOKEN}       - GITHUB_REPO=${GITHUB_REPO}       - GITHUB_BRANCH=${GITHUB_BRANCH}       - IMAGE_FILENAME_BASE=${IMAGE_FILENAME_BASE}       - GITHUB_PATH=${GITHUB_PATH}`

Start it:

`docker compose up -d`

---
## 🖼️ How It Works
1. The bot watches your configured Discord channel.    
2. When an image is posted:    
    - It downloads and resizes the image to 1024×1024        
    - Saves it as:        
        - `${IMAGE_FILENAME_BASE}.png`            
        - `${IMAGE_FILENAME_BASE}_YYYYMMDD_HHMMSS.png`            
    - Commits both to GitHub with your Discord message as the commit message        
    - Updates `gallery.html` with the image and alt text (commit message)
        

---
## 🎮 VRChat Integration Example
You can use these uploaded images in your **VRChat worlds** using Udon’s image downloaders or dynamic materials.
For example, if your repository is public:
`https://raw.githubusercontent.com/YourUsername/YourRepoName/main/uploads/poster.png`

That URL can be used as the source for:
- **Udon Image Loader scripts**    
- **Dynamic Texture systems**    
- **In-game poster replacements**    
- **Live gallery walls**    

The bot effectively becomes a **Discord → VRChat image pipeline**, letting you update in-world visuals just by posting new images in Discord.

---
## 🧰 Development Notes
- Built with Node.js 20+    
- Uses `discord.js`, `sharp`, and `@octokit/rest`    
- Docker image includes all dependencies automatically
