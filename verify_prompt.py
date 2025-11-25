import requests
import json
import sys

def verify_response():
    url = "http://localhost:8000/analyze"
    
    conversation = """
    Prospect: Hi, I'm interested in your product but it seems expensive.
    User: It's actually very cost effective. What is your budget?
    Prospect: We have about $500/month.
    User: Our pro plan fits that perfectly.
    Prospect: But I heard the support is bad.
    """
    
    payload = {
        "text": conversation,
        "kb_name": "Sample"
    }
    
    try:
        print("Sending request to backend...")
        response = requests.post(url, json=payload)
        response.raise_for_status()
        
        result = response.json()
        print("\n--- Analysis Result ---")
        print(json.dumps(result, indent=2))
        
        # Basic validation
        insights = result.get("insights", [])
        messages = result.get("suggested_messages", [])
        
        print("\n--- Validation ---")
        has_quotes = any('"' in i or "'" in i for i in insights)
        print(f"Insights contain quotes: {has_quotes}")
        
        if not has_quotes:
            print("WARNING: Insights might not be quoting the conversation.")
            
        print("Check 'suggested_messages' manually to ensure they address the support issue (latest context).")
        
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to backend. Make sure it is running on port 8000.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    verify_response()
