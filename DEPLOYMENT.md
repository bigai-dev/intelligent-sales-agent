# Deploying to Render (Free Tier)

This guide explains how to deploy the Sales Agent Backend to Render.com for free.

## Prerequisites

1.  **GitHub Account**: You need a GitHub account to host the code.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **OpenAI API Key**: You need your API key ready.

## Step 1: Prepare Your Knowledge Base

Since the free tier of Render does not keep files permanently, we need to "pre-bake" your Knowledge Base into the code.

1.  **Run the backend locally**:
    ```bash
    ./run_backend.sh
    ```
2.  **Upload your files**:
    - Use the Chrome Extension to upload your PDF/TXT files.
    - OR use the API directly if you prefer.
3.  **Verify**: Ensure `chroma_db` folder in your project directory is populated.

## Step 2: Push to GitHub

1.  Create a new repository on GitHub.
2.  Push your code (including the `chroma_db` folder):
    ```bash
    git init
    git add .
    git commit -m "Initial commit with Knowledge Base"
    git branch -M main
    git remote add origin <your-github-repo-url>
    git push -u origin main
    ```

## Step 3: Deploy on Render

1.  Go to your [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** and select **Blueprints**.
3.  Connect your GitHub account and select your repository.
4.  Render will automatically detect the `render.yaml` file.
5.  Click **Apply**.
6.  **IMPORTANT**: You will need to set your Environment Variable.
    - Go to the **Environment** tab of your new service.
    - Add `OPENAI_API_KEY` and paste your key.
    - Render might ask for this during the Blueprint setup as well.

## Updating the Knowledge Base

To update your Knowledge Base in the future:

1.  Run the backend locally.
2.  Upload new files.
3.  Commit and push the changes to GitHub:
    ```bash
    git add chroma_db
    git commit -m "Update Knowledge Base"
    git push
    ```
4.  Render will automatically redeploy with the new data.

> [!WARNING]
> **Important Limitation**: Because free hosting servers (Render Free Tier, HF Spaces) have **ephemeral storage**, any files you upload via the Chrome Extension UI will **disappear** when the server restarts (usually after 15 minutes of inactivity).
>
> To permanently update your Knowledge Base, you **MUST** follow the steps above (update locally -> push to GitHub).

---

## Alternative: Hugging Face Spaces (No Credit Card Required)

If Render asks for a credit card and you don't want to provide one, use **Hugging Face Spaces**.

1.  **Sign Up**: Go to [huggingface.co](https://huggingface.co) and create an account.
2.  **Create Space**:
    - Click **New Space**.
    - Name: `sales-agent-backend`
    - SDK: **Docker**
    - Hardware: **Free**
3.  **Deploy**:
    - Hugging Face will give you a git command to clone the space.
    - Copy the contents of this project into that folder.
    - Push to the Hugging Face remote.
4.  **Environment Variables**:
    - Go to **Settings** in your Space.
    - Scroll to **Variables and secrets**.
    - Add `OPENAI_API_KEY` as a **Secret**.

