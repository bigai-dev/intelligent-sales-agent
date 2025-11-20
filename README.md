# Sales Agent AI - Chrome Extension

An AI-powered Chrome Extension that analyzes Messenger conversations to extract sales signals, objections, and buying intent, then provides actionable deal-closing strategies using a proprietary knowledge base and OpenAI.

## Architecture

- **Backend**: FastAPI server with RAG (ChromaDB) + OpenAI GPT-4
- **Frontend**: Chrome Extension (Manifest V3) with premium UI

## Setup Instructions

### 1. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Create .env file with your OpenAI API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start the FastAPI server
uvicorn main:app --reload
```

The backend will run at `http://localhost:8000`

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The extension should now appear in your browser

### 3. Upload Knowledge Base

Before analyzing conversations, upload your internal knowledge base:

1. Click the extension icon in Chrome
2. Click "Upload Knowledge Base"
3. Upload PDF or TXT files containing:
   - Product data
   - Sales playbooks
   - Common objections and responses
   - Case studies
   - SOPs

### 4. Analyze Conversations

1. Navigate to any Messenger conversation (or any page with chat text)
2. Click the extension icon
3. Click "Analyze Now"
4. View extracted insights and recommended strategies

## Features

- **Automatic Text Extraction**: Content script scrapes conversation text from the active tab
- **RAG-Powered Analysis**: Uses ChromaDB to retrieve relevant context from your knowledge base
- **AI Insights**: OpenAI GPT-4 analyzes conversations and provides:
  - Sales signals and buying intent
  - Detected objections or hesitations
  - Deal-closing strategies
- **Premium UI**: Dark mode with glassmorphism and smooth animations

## Development

### Project Structure

```
stellar-cosmos/
├── main.py                 # FastAPI backend
├── rag_engine.py          # RAG logic (ChromaDB + LangChain)
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
├── extension/
│   ├── manifest.json     # Chrome Extension config
│   ├── popup.html        # Extension popup UI
│   ├── popup.js          # Popup logic
│   ├── style.css         # Premium styling
│   ├── content.js        # Page scraping script
│   └── icon.png          # Extension icon
└── chroma_db/            # Vector database (auto-created)
```

### API Endpoints

- `GET /` - Health check
- `POST /analyze` - Analyze conversation text
- `POST /upload-kb` - Upload knowledge base files

## Requirements

- Python 3.8+
- Chrome/Chromium browser
- OpenAI API key

## Future Enhancements

- [ ] Messenger-specific DOM selectors for better scraping
- [ ] Side panel UI for larger analysis view
- [ ] File upload UI in extension popup
- [ ] History/cache of past analyses
- [ ] Export strategies as templates
