# Deploying to Render (Free Tier)

This guide explains how to deploy the Sales Agent Backend to Render.com for free, using **Pinecone** for persistent storage.

## Prerequisites

1.  **GitHub Account**: You need a GitHub account to host the code.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **Pinecone Account**: Sign up at [pinecone.io](https://pinecone.io) (Free Tier).
4.  **OpenAI API Key**: You need your API key ready.

## Step 1: Setup Pinecone (The "Perfect" Storage)

To ensure your Knowledge Base persists even when the free server restarts, we use Pinecone.

1.  Log in to Pinecone.
2.  Create a new Index:
    -   **Name**: `sales-agent`
    -   **Dimensions**: `1536` (Important for OpenAI models)
    -   **Metric**: `cosine`
3.  Get your **API Key** from the API Keys tab.

## Step 2: Push to GitHub

1.  Push your latest code to GitHub:
    ```bash
    git add .
    git commit -m "Migrate to Pinecone"
    git push
    ```

## Step 3: Deploy on Render

1.  Go to your [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** and select **Blueprints**.
3.  Connect your GitHub account and select your repository.
4.  Click **Apply**.
5.  **Environment Variables**:
    -   Render will ask for these, or you can add them in the **Environment** tab:
    -   `OPENAI_API_KEY`: Your OpenAI Key.
    -   `PINECONE_API_KEY`: Your Pinecone Key.
    -   `PINECONE_INDEX_NAME`: `sales-agent`

## Updating the Knowledge Base

**Good News!** Because we are using Pinecone, you can now update the Knowledge Base **directly from the Chrome Extension UI**.
-   Upload a file -> It gets saved to Pinecone cloud.
-   Server restarts -> Data is still there.
-   No need to redeploy for KB updates!
