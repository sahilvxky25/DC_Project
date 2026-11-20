from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import firestore
from app.auth import require_user
from app.firebase import get_db
from app.models import SubmitQuizRequest
from app.services.progress_analyzer import analyze_progress
from app.services.question_generator import generate_question_batch

router=APIRouter(prefix="/api/quiz",tags=["adaptive quiz"])

def _db():
    try: return get_db()
    except Exception as exc: raise HTTPException(503,"Firebase Admin is not configured. Check backend/.env credentials.") from exc

def _progress(db,uid):
    snap=db.document(f"users/{uid}/progress/overview").get()
    return (snap.to_dict() or {}).get("progress") or {} if snap.exists else {}

def _adaptive(db,uid):
    snap=db.document(f"users/{uid}/adaptiveQuiz/profile").get()
    return snap.to_dict() or {} if snap.exists else {}

def _save(db,uid,data):
    data["updatedAt"]=firestore.SERVER_TIMESTAMP
    db.document(f"users/{uid}/adaptiveQuiz/profile").set(data,merge=True)

# Sessions use a top-level subcollection under the user document. The profile
# document remains at users/{uid}/adaptiveQuiz/profile.
def _session_ref(db,uid,session_id):
    return db.document(f"users/{uid}/adaptiveQuizSessions/{session_id}")

@router.post("/start")
async def start_quiz(user=Depends(require_user)):
    db=_db(); uid=user["uid"]; progress=_progress(db,uid); adaptive=_adaptive(db,uid)
    progress["topicPerformance"]=adaptive.get("topicPerformance") or {}
    profile=analyze_progress(progress)
    questions=await generate_question_batch(profile,adaptive.get("questionHistory") or [])
    session_id=str(uuid4())
    _session_ref(db,uid,session_id).set({
      "questions":questions,"createdAt":firestore.SERVER_TIMESTAMP,"status":"open"})
    public=[{k:v for k,v in q.items() if k not in ("correctAnswer","explanation")} for q in questions]
    return {"success":True,"sessionId":session_id,"count":8,"profile":profile,"questions":public}

@router.post("/submit")
async def submit_quiz(payload:SubmitQuizRequest,user=Depends(require_user)):
    db=_db(); uid=user["uid"]; ref=_session_ref(db,uid,payload.sessionId); snap=ref.get()
    if not snap.exists or (snap.to_dict() or {}).get("status")!="open":
        raise HTTPException(404,"Quiz session not found or already submitted.")
    questions=(snap.to_dict() or {}).get("questions")
    if not isinstance(questions,list) or len(questions)!=8: raise HTTPException(500,"Stored quiz session is invalid.")
    previous=_adaptive(db,uid); performance=dict(previous.get("topicPerformance") or {})
    correct=0; review=[]
    for i,q in enumerate(questions):
        selected=payload.answers[i]; ok=selected>=0 and selected==q["correctAnswer"]; correct+=int(ok)
        topic=q["topic"]; stats=dict(performance.get(topic) or {"attempts":0,"correct":0})
        stats["attempts"]=int(stats.get("attempts") or 0)+1; stats["correct"]=int(stats.get("correct") or 0)+int(ok)
        performance[topic]=stats
        review.append({"id":q["id"],"topic":topic,"question":q["question"],"options":q["options"],
          "selectedAnswer":selected,"correctAnswer":q["correctAnswer"],"isCorrect":ok,
          "explanation":q["explanation"],"hint":q.get("hint","")})
    score=round(correct/8*100); history=list(previous.get("questionHistory") or [])
    history.extend(q["question"] for q in questions)
    _save(db,uid,{"topicPerformance":performance,"questionHistory":history[-40:],
      "lastScore":score,"totalAttempts":int(previous.get("totalAttempts") or 0)+8})
    ref.update({"status":"submitted","submittedAt":firestore.SERVER_TIMESTAMP,"answers":payload.answers,"score":score})
    return {"success":True,"correct":correct,"total":8,"score":score,"review":review,"topicPerformance":performance}

@router.get("/profile")
async def quiz_profile(user=Depends(require_user)):
    db=_db(); uid=user["uid"]; progress=_progress(db,uid); adaptive=_adaptive(db,uid)
    progress["topicPerformance"]=adaptive.get("topicPerformance") or {}
    return {"success":True,"course":analyze_progress(progress),"adaptive":adaptive}
