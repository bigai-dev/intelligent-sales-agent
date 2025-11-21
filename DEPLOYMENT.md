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
