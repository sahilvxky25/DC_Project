import json,re
from groq import AsyncGroq
from fastapi import HTTPException
from app.config import get_settings
from app.services.progress_analyzer import choose_topic_weights

DIFFICULTIES={"beginner","intermediate","advanced","expert"}

def validate_batch(items, allowed_topics, count=8):
    if not isinstance(items,list) or len(items)!=count: raise ValueError(f"Model must return exactly {count} questions.")
    result=[]; seen=set()
    for i,item in enumerate(items):
        if not isinstance(item,dict): raise ValueError("Malformed question.")
        topic=str(item.get("topic","")).strip(); question=str(item.get("question","")).strip()
        options=[str(v).strip() for v in item.get("options",[])] if isinstance(item.get("options"),list) else []
        answer=item.get("correctAnswer"); explanation=str(item.get("explanation","")).strip()
        difficulty=str(item.get("difficulty","intermediate")).lower()
        if topic not in allowed_topics: raise ValueError("Question uses a topic the learner has not started.")
        if not 12<=len(question)<=700 or len(options)!=4 or any(not x or len(x)>240 for x in options) or len(set(options))!=4 or type(answer)is not int or answer not in range(4) or not 12<=len(explanation)<=900 or difficulty not in DIFFICULTIES:
            raise ValueError("A generated question failed validation.")
        fingerprint=re.sub(r"[^a-z0-9]","",question.lower())
        if fingerprint in seen: raise ValueError("The model generated a duplicate question.")
        seen.add(fingerprint)
        result.append({"id":f"ai-{i+1}","topic":topic,"question":question,"options":options,"correctAnswer":answer,
                       "explanation":explanation,"hint":str(item.get("hint") or "Identify the relevant networking principle before comparing the choices."),
                       "difficulty":difficulty,"type":str(item.get("type") or "concept")})
    return result

async def generate_question_batch(profile, previous_questions=None):
    s=get_settings()
    if not s.groq_api_key: raise HTTPException(503,"Groq is not configured. Set GROQ_API_KEY in backend/.env.")
    weights=choose_topic_weights(profile)
    if not weights: raise HTTPException(422,"Complete or attempt a course module before starting an adaptive quiz.")
    client=AsyncGroq(api_key=s.groq_api_key)
    try:
        response=await client.chat.completions.create(
          model=s.groq_model,temperature=.75,max_tokens=4500,response_format={"type":"json_object"},
          messages=[
            {"role":"system","content":"You are BitSecure, an expert Data Communications and Computer Networks instructor. Return only JSON with a questions array. Each question needs topic, question, exactly four options, zero-based integer correctAnswer, explanation, hint, difficulty (beginner/intermediate/advanced/expert), and type. Be accurate, unambiguous and self-contained. Use only eligible topics; avoid supplied previous questions. No markdown."},
            {"role":"user","content":json.dumps({"task":"Generate exactly 8 MCQs for this learner.","course":"Data Communications and Computer Networks",
              "overallCompletion":profile["overallCompletion"],"eligibleTopicWeights":weights,
              "distribution":"Prioritize weak eligible topics, vary difficulty by completion and accuracy. Do not test topics not started.",
              "previousQuestions":(previous_questions or [])[-40:],
              "outputShape":{"questions":[{"topic":"TCP","question":"Question text","options":["A","B","C","D"],"correctAnswer":0,"explanation":"Explanation","hint":"Hint","difficulty":"intermediate","type":"concept"}]}})}
          ])
        data=json.loads(response.choices[0].message.content or "{}")
        return validate_batch(data.get("questions"),{x["topic"] for x in weights})
    finally: await client.close()
