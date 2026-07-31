from flask import Flask, render_template, jsonify, request
from flask_pymongo import PyMongo
from bson.objectid import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from openai import OpenAI
import os

load_dotenv()  # loads .env file

# Groq's API is OpenAI-compatible, so we reuse the openai client pointed at
# Groq's endpoint instead of adding a new dependency. Get a free key at
# https://console.groq.com/keys
ai_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1",
)
AI_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = (
    "You are OmniChat AI, a helpful assistant. Answer clearly and accurately. "
    "Structure longer answers with headings, bullet points, or numbered steps "
    "where that makes them easier to read; keep short answers to a sentence or two."
)

app = Flask(__name__)
app.config["MONGO_URI"] = os.getenv("MONGO_URI")
mongo = PyMongo(app)

def chat_messages(chat):
    """Normalize a ChatHistory doc into a list of {role, content} messages,
    supporting older docs that only stored a single question/answer pair."""
    if chat.get("messages"):
        return chat["messages"]
    messages = []
    if chat.get("question"):
        messages.append({"role": "user", "content": chat["question"]})
    if chat.get("answer"):
        messages.append({"role": "assistant", "content": chat["answer"]})
    return messages

def capitalize_first(text):
    return text[:1].upper() + text[1:] if text else text

@app.route("/")
def home():
    docs = mongo.db.ChatHistory.find({}).sort("_id", -1)
    myChats = []
    for doc in docs:
        messages = chat_messages(doc)
        if not messages:
            continue
        myChats.append({"_id": str(doc["_id"]), "title": capitalize_first(messages[0]["content"])})
    return render_template("index.html", myChats=myChats)

@app.route("/ask", methods=["GET", "POST"])
def qa():
    if request.method == "POST":
        question = request.json.get("question")
        history = request.json.get("history") or []
        conversation_id = request.json.get("conversation_id")

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for msg in history:
            if msg.get("role") in ("user", "assistant") and msg.get("content"):
                messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": question})

        response = ai_client.chat.completions.create(
            model=AI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        answer = response.choices[0].message.content

        new_messages = [
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]

        object_id = None
        if conversation_id:
            try:
                object_id = ObjectId(conversation_id)
            except InvalidId:
                object_id = None

        if object_id:
            mongo.db.ChatHistory.update_one(
                {"_id": object_id},
                {"$push": {"messages": {"$each": new_messages}}},
            )
        else:
            inserted = mongo.db.ChatHistory.insert_one({"messages": new_messages})
            object_id = inserted.inserted_id

        return jsonify({"question": question, "answer": answer, "conversation_id": str(object_id)})

    return jsonify({"result": "Send a POST request with a question."})

@app.route("/chat/<chat_id>", methods=["GET", "DELETE"])
def chat_detail(chat_id):
    try:
        object_id = ObjectId(chat_id)
    except InvalidId:
        return jsonify({"error": "Invalid chat id"}), 400

    if request.method == "DELETE":
        result = mongo.db.ChatHistory.delete_one({"_id": object_id})
        if result.deleted_count == 0:
            return jsonify({"error": "Chat not found"}), 404
        return jsonify({"success": True})

    doc = mongo.db.ChatHistory.find_one({"_id": object_id})
    if not doc:
        return jsonify({"error": "Chat not found"}), 404
    return jsonify({"messages": chat_messages(doc)})

if __name__ == "__main__":
    app.run(debug=True, port=int(os.getenv("PORT", 5001)))