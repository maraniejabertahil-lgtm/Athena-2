# Setup: Docker and your AI models

## 1. Install Docker on your computer

Docker runs the code sandbox. Without it, the Run button shows "Docker sandbox is unavailable" and nothing runs. That is the intended safe behaviour.

- **Windows or Mac:** download Docker Desktop from docker.com, install it, and start it. Wait until it says it is running.
- **Linux (Ubuntu):** run `sudo apt update && sudo apt install -y docker.io` and then `sudo usermod -aG docker $USER`. Log out and back in.

Check it works by opening a terminal and typing:

    docker run --rm hello-world

If you see a welcome message, Docker is ready. Then download the image the sandbox uses:

    docker pull node:22-alpine

## 2. Choose your AI model in `.env`

Copy `.env.example` to `.env` and fill in ONE of these blocks.

**Anthropic Claude**

    AI_PROVIDER=anthropic
    ANTHROPIC_API_KEY=your-key-from-console.anthropic.com
    ANTHROPIC_MODEL=claude-sonnet-4-5

Use the exact model name shown in Anthropic's model list. Other Claude models use the same settings.

**Google Gemini** (uses Google's OpenAI-compatible endpoint)

    AI_PROVIDER=openai-compatible
    AI_BASE_URL=the-endpoint-from-Google's-current-docs
    AI_API_KEY=your-key-from-Google-AI-Studio
    AI_MODEL=the-exact-model-name-from-Google-AI-Studio

Copy the base URL and model name exactly from Google's current documentation or AI Studio. Model names change often, and the app cannot check them for you.

## 3. Start the app

    npm install
    npx playwright install chromium
    npm start

Open http://localhost:3000 in your browser.
