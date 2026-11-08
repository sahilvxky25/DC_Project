const { app } = require("@azure/functions");
const crypto = require("node:crypto");
const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "bit-7ce8a";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";
const TOKEN_TTL_MS = 30 * 60 * 1000;

if (!getApps().length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount), projectId: PROJECT_ID });
  } else {
    initializeApp({ projectId: PROJECT_ID });
  }
}

function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(status, body) {
  return { status, headers: headers(), jsonBody: body };
}

function corsPreflight() {
  return { status: 204, headers: headers() };
}

async function authenticatedUid(request) {
  const value = request.headers.get("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("AUTH_REQUIRED");
  const decoded = await getAuth().verifyIdToken(match[1]);
  return decoded.uid;
}

function signPayload(payload) {
  const secret = process.env.QUIZ_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error("QUIZ_SIGNING_SECRET must contain at least 32 characters.");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

function readSignedPayload(token) {
  const secret = process.env.QUIZ_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error("Quiz signing is not configured.");
  if (typeof token !== "string" || token.length > 6000) throw new Error("Invalid answer token.");
  const parts = token.split(".");
  if (parts.length !== 2) throw new Error("Invalid answer token.");
  const expected = crypto.createHmac("sha256", secret).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    throw new Error("Answer token is invalid.");
  }
  const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) throw new Error("This question has expired. Please request another.");
  return payload;
}

function safeQuestion(data) {
  if (!data || typeof data.question !== "string" || data.question.length < 12 || data.question.length > 700) {
    throw new Error("Gemini returned an invalid question.");
  }
  if (!Array.isArray(data.options) || data.options.length !== 4 ||
      data.options.some(option => typeof option !== "string" || !option.trim() || option.length > 220)) {
    throw new Error("Gemini returned invalid answer options.");
  }
  const answer = Number(data.correctIndex);
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) throw new Error("Gemini returned an invalid answer key.");
  return {
    topic: String(data.topic || "Networking").slice(0, 50),
    question: data.question.trim(),
    options: data.options.map(option => option.trim()),
    correctIndex: answer,
    explanation: String(data.explanation || "Review the relevant networking concept.").slice(0, 700),
    hint: String(data.hint || "Identify the networking concept being tested.").slice(0, 300)
  };
}

async function generateWithGemini({ difficulty, topic, recent, level }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured yet. Add GEMINI_API_KEY in Azure Function App settings.");
  const prompt = [
    "Create exactly one original multiple-choice question for a computer networking learning platform.",
    "Return only JSON matching the requested schema. Exactly four distinct options.",
    "The correctIndex must be the zero-based index of the single unambiguously correct option.",
    "The explanation must teach why the answer is correct. The hint must guide without revealing the answer.",
    "Stay within data communications and computer networking: OSI/TCP-IP, framing, error detection/correction, ARQ, IP/subnetting, routing, TCP/UDP, congestion/flow control, DNS, HTTP/TLS, sockets, NAT and network security.",
    "Avoid trick questions, ambiguous wording, unsupported facts, and questions substantially similar to recent questions.",
    "Difficulty 1 is foundational; 5 is challenging and may include multi-step calculations.",
    "Learner level: " + level + ". Difficulty: " + difficulty + "/5. Preferred topic: " + topic + ".",
    "Recent performance (most recent first): " + JSON.stringify((recent || []).slice(0, 6))
  ].join("\n");
  const response = await fetch(GEMINI_URL + encodeURIComponent(GEMINI_MODEL) + ":generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.75,
        maxOutputTokens: 700,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            topic: { type: "STRING" },
            question: { type: "STRING" },
            options: { type: "ARRAY", items: { type: "STRING" } },
            correctIndex: { type: "INTEGER" },
            explanation: { type: "STRING" },
            hint: { type: "STRING" }
          },
          required: ["topic", "question", "options", "correctIndex", "explanation", "hint"]
        }
      }
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result.error?.message || "Gemini could not generate a question.";
    throw new Error(message.slice(0, 300));
  }
  const raw = result.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("");
  if (!raw) throw new Error("Gemini returned an empty response.");
  return safeQuestion(JSON.parse(raw));
}

app.http("quizHealth", {
  route: "quiz/health",
  methods: ["GET", "OPTIONS"],
  authLevel: "anonymous",
  handler: async request => request.method === "OPTIONS"
    ? corsPreflight()
    : json(200, { ok: true, provider: "gemini", model: GEMINI_MODEL })
});

app.http("generateAdaptiveQuestion", {
  route: "quiz/generate",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async request => {
    if (request.method === "OPTIONS") return corsPreflight();
    try {
      const uid = await authenticatedUid(request);
      const body = await request.json();
      const difficulty = Math.max(1, Math.min(5, Number(body.difficulty) || 1));
      const level = ["Beginner", "Intermediate", "Advanced", "Expert", "Master"].includes(body.level)
        ? body.level : "Beginner";
      const topic = typeof body.topic === "string" ? body.topic.slice(0, 50) : "Mixed networking";
      const question = await generateWithGemini({
        difficulty, topic, level,
        recent: Array.isArray(body.recent) ? body.recent.slice(0, 6) : []
      });
      const questionId = crypto.randomUUID();
      const answerToken = signPayload({
        uid, questionId, correctIndex: question.correctIndex,
        explanation: question.explanation, exp: Date.now() + TOKEN_TTL_MS
      });
      return json(200, {
        questionId, topic: question.topic, question: question.question,
        options: question.options, hint: question.hint,
        difficulty, answerToken
      });
    } catch (error) {
      const authError = error.message === "AUTH_REQUIRED" || /Firebase ID token|Decoding Firebase ID token/i.test(error.message);
      return json(authError ? 401 : 502, {
        error: authError ? "Your session has expired. Sign in again to use the AI quiz." : error.message
      });
    }
  }
});

app.http("submitAdaptiveAnswer", {
  route: "quiz/answer",
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: async request => {
    if (request.method === "OPTIONS") return corsPreflight();
    try {
      const uid = await authenticatedUid(request);
      const body = await request.json();
      const signed = readSignedPayload(body.answerToken);
      if (signed.uid !== uid) return json(403, { error: "This question belongs to another account." });
      const selectedIndex = Number(body.selectedIndex);
      if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 4) {
        return json(400, { error: "Choose one of the four options." });
      }
      const correct = selectedIndex === signed.correctIndex;
      return json(200, {
        correct, correctIndex: signed.correctIndex,
        explanation: signed.explanation,
        questionId: signed.questionId
      });
    } catch (error) {
      const authError = error.message === "AUTH_REQUIRED" || /Firebase ID token|Decoding Firebase ID token/i.test(error.message);
      return json(authError ? 401 : 400, {
        error: authError ? "Your session has expired. Sign in again to use the AI quiz." : error.message
      });
    }
  }
});
