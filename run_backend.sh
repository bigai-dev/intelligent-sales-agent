#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Sales Agent Backend Setup...${NC}"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Creating virtual environment...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}Virtual environment created.${NC}"
else
    echo -e "${GREEN}Virtual environment found.${NC}"
fi

# Activate venv
source venv/bin/activate

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
pip install -r requirements.txt

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}Creating .env file from example...${NC}"
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}.env file created. PLEASE EDIT .env WITH YOUR API KEYS!${NC}"
    else
        echo -e "${YELLOW}Warning: .env.example not found. Skipping .env creation.${NC}"
    fi
else
    echo -e "${GREEN}.env file found.${NC}"
fi

# Run the server
echo -e "${GREEN}Starting FastAPI server...${NC}"
uvicorn main:app --reload
