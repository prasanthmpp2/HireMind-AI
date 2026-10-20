import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print("==================================================")
    print("HireMind AI - Intelligent HR Recruitment Assistant")
    print(f"Server running at: http://localhost:{port}")
    print("==================================================")
    app.run(host="0.0.0.0", port=port, debug=True)

