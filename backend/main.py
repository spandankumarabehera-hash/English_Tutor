import json
import uuid
import datetime
import hashlib
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query, Header, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
from gtts import gTTS

from database import init_db, get_db, User, ChatSession, Message, SavedWord, UserProgress
from schemas import (
    UserCreate, UserLogin, AuthResponse,
    RecoveryQuestionResponse, ResetPasswordRequest, RecoverUsernameRequest,
    MessageCreate, MessageResponse, 
    ChatSessionResponse, ChatSessionCreate,
    DictionaryLookupRequest, DictionaryLookupResponse,
    VocabularySaveRequest, VocabularyResponse,
    UserProgressResponse, QuizQuestion, QuizResponse
)
from tutor_engine import tutor_engine

app = FastAPI(title="English AI Tutor Backend", version="1.0.0")

# Enable CORS for frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

# --- Helpers ---
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_current_user_id(x_user_id: Optional[str] = Header(None)) -> int:
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization required: X-User-Id header missing"
        )
    try:
        return int(x_user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid X-User-Id format"
        )

# --- Authentication & Recovery Endpoints ---

@app.post("/api/auth/register", response_model=AuthResponse)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == payload.username.lower().strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username is already taken"
        )
    
    pwd_hash = hash_password(payload.password)
    # Store recovery answer as normalized lowercase
    recovery_ans_clean = payload.recovery_answer.lower().strip()
    
    db_user = User(
        username=payload.username.lower().strip(),
        password_hash=pwd_hash,
        recovery_question=payload.recovery_question,
        recovery_answer=recovery_ans_clean
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Initialize user progress
    db_progress = UserProgress(
        user_id=db_user.id,
        streak=0,
        xp=0,
        sentences_spoken=0,
        grammar_accuracy=100.0,
        time_spent=0,
        quizzes_completed=0,
        last_active=datetime.datetime.utcnow()
    )
    db.add(db_progress)
    db.commit()

    return AuthResponse(
        user_id=db_user.id,
        username=db_user.username,
        message="Registration successful"
    )

@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == payload.username.lower().strip()).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    hashed_input = hash_password(payload.password)
    if db_user.password_hash != hashed_input:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    return AuthResponse(
        user_id=db_user.id,
        username=db_user.username,
        message="Login successful"
    )

@app.get("/api/auth/recovery-question", response_model=RecoveryQuestionResponse)
def get_recovery_question(username: str, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == username.lower().strip()).first()
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="Username not found"
        )
    if not db_user.recovery_question:
        raise HTTPException(
            status_code=400,
            detail="No recovery question registered for this user"
        )
    return RecoveryQuestionResponse(
        username=db_user.username,
        recovery_question=db_user.recovery_question
    )

@app.post("/api/auth/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == payload.username.lower().strip()).first()
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="Username not found"
        )
    
    # Check normalized security answer
    ans_input = payload.recovery_answer.lower().strip()
    if db_user.recovery_answer != ans_input:
        raise HTTPException(
            status_code=400,
            detail="Incorrect security recovery answer"
        )
    
    # Reset password
    db_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password reset successful"}

@app.post("/api/auth/recover-username")
def recover_username(payload: RecoverUsernameRequest, db: Session = Depends(get_db)):
    ans_input = payload.recovery_answer.lower().strip()
    db_user = db.query(User).filter(
        User.recovery_question == payload.recovery_question,
        User.recovery_answer == ans_input
    ).first()
    
    if not db_user:
        raise HTTPException(
            status_code=400,
            detail="No matching user found with these security answers"
        )
    return {
        "username": db_user.username,
        "message": "Username recovered successfully"
    }

# --- Sessions Endpoints ---

@app.get("/api/sessions", response_model=list[ChatSessionResponse])
def get_sessions(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.created_at.desc()).all()
    return sessions

@app.post("/api/sessions", response_model=ChatSessionResponse)
def create_session(session: ChatSessionCreate, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    existing = db.query(ChatSession).filter(ChatSession.id == session.id, ChatSession.user_id == user_id).first()
    if existing:
        return existing
    db_session = ChatSession(id=session.id, user_id=user_id, title=session.title, mode=session.mode)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.get("/api/sessions/{session_id}/messages", response_model=list[MessageResponse])
def get_session_messages(session_id: str, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")
    
    messages = db.query(Message).filter(Message.session_id == session_id).order_by(Message.created_at.asc()).all()
    return messages

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or access denied")
    db.delete(session)
    db.commit()
    return {"message": "Session deleted successfully"}

# --- Chat Endpoint ---

@app.post("/api/chat", response_model=MessageResponse)
def chat_with_tutor(payload: MessageCreate, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == payload.session_id, ChatSession.user_id == user_id).first()
    if not session:
        title = payload.text[:30] + "..." if len(payload.text) > 30 else payload.text
        session = ChatSession(id=payload.session_id, user_id=user_id, title=title, mode=payload.mode or "free_chat")
        db.add(session)
        db.commit()
        db.refresh(session)
    
    past_messages = db.query(Message).filter(Message.session_id == payload.session_id).order_by(Message.created_at.asc()).all()
    # FILTER OUT TECHNICAL INITIALIZATION TRIGGERS SO THE AI NEVER SEES THEM AND DOESN'T REPEAT THEM!
    history = [{"sender": msg.sender, "text": msg.text} for msg in past_messages if not msg.text.startswith("Initialize ")]

    # Handle initializations silently
    if payload.text.startswith("Initialize "):
        grammar_res = {"is_correct": True, "corrected_text": payload.text, "corrections": []}
        user_msg = Message(
            session_id=payload.session_id,
            sender="user",
            text=payload.text,
            corrected_text=None,
            grammar_data=None
        )
        db.add(user_msg)
        
        tutor_reply = tutor_engine.get_tutor_response("", [], mode=session.mode)
        ai_msg = Message(
            session_id=payload.session_id,
            sender="ai",
            text=tutor_reply
        )
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)
        return ai_msg

    # 3. Analyze grammar for USER message
    grammar_res = tutor_engine.correct_grammar(payload.text)
    is_correct = grammar_res.get("is_correct", True)
    corrected_text = grammar_res.get("corrected_text", payload.text)
    corrections = grammar_res.get("corrections", [])
    
    grammar_data_str = json.dumps(corrections) if corrections else None

    # Save User message
    user_msg = Message(
        session_id=payload.session_id,
        sender="user",
        text=payload.text,
        corrected_text=corrected_text if not is_correct else None,
        grammar_data=grammar_data_str
    )
    db.add(user_msg)

    # 4. Generate AI Reply
    tutor_reply = tutor_engine.get_tutor_response(payload.text, history, mode=session.mode)
    
    # Save AI message
    ai_msg = Message(
        session_id=payload.session_id,
        sender="ai",
        text=tutor_reply
    )
    db.add(ai_msg)

    # 5. Update user progress stats
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if progress:
        progress.sentences_spoken += 1
        
        current_score = 100.0 if is_correct else max(20.0, 100.0 - (len(corrections) * 20.0))
        n = progress.sentences_spoken
        progress.grammar_accuracy = round(((progress.grammar_accuracy * (n - 1)) + current_score) / n, 1)
        
        xp_gain = 15 if is_correct else 10
        progress.xp += xp_gain

        # Streak calculation
        now = datetime.datetime.utcnow()
        delta = now.date() - progress.last_active.date()
        if delta.days == 1:
            progress.streak += 1
        elif delta.days > 1:
            progress.streak = 1
        elif progress.streak == 0:
            progress.streak = 1
        
        progress.last_active = now
        
    db.commit()
    db.refresh(ai_msg)

    return ai_msg

# --- Dictionary Assistant Endpoints ---

@app.post("/api/dictionary/lookup", response_model=DictionaryLookupResponse)
def lookup_word(payload: DictionaryLookupRequest):
    data = tutor_engine.lookup_dictionary(payload.word)
    return data

@app.post("/api/vocabulary/save", response_model=VocabularyResponse)
def save_word(payload: VocabularySaveRequest, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    word_clean = payload.word.lower().strip()
    existing = db.query(SavedWord).filter(SavedWord.word == word_clean, SavedWord.user_id == user_id).first()
    if existing:
        return existing
    
    db_word = SavedWord(
        user_id=user_id,
        word=word_clean,
        definition=payload.definition,
        part_of_speech=payload.part_of_speech,
        explanation=payload.explanation,
        synonyms=",".join(payload.synonyms),
        antonyms=",".join(payload.antonyms),
        examples=json.dumps(payload.examples),
        pronunciation=payload.pronunciation
    )
    db.add(db_word)
    db.commit()
    db.refresh(db_word)
    return db_word

@app.get("/api/vocabulary", response_model=list[VocabularyResponse])
def get_vocabulary(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    words = db.query(SavedWord).filter(SavedWord.user_id == user_id).order_by(SavedWord.created_at.desc()).all()
    return words

@app.delete("/api/vocabulary/{word}")
def delete_word(word: str, user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    db_word = db.query(SavedWord).filter(SavedWord.word == word.lower().strip(), SavedWord.user_id == user_id).first()
    if not db_word:
        raise HTTPException(status_code=404, detail="Word not found in saved list")
    db.delete(db_word)
    db.commit()
    return {"message": f"'{word}' deleted from vocabulary"}

# --- User Progress Endpoint ---

@app.get("/api/progress", response_model=UserProgressResponse)
def get_progress(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        progress = UserProgress(user_id=user_id, streak=0, xp=0, sentences_spoken=0, grammar_accuracy=100.0, time_spent=0, quizzes_completed=0)
        db.add(progress)
        db.commit()
        db.refresh(progress)
    return progress

# --- Study Time Tracker ---

@app.post("/api/progress/time", response_model=UserProgressResponse)
def log_study_time(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        raise HTTPException(status_code=404, detail="User progress profile not found")
    
    progress.time_spent += 1
    progress.xp += 5
    db.commit()
    db.refresh(progress)
    return progress

# --- AI Mock Quiz Generator Endpoints ---

@app.get("/api/quiz/generate", response_model=list[QuizQuestion])
def get_mock_quiz(level: str = Query("beginner", description="English level"), user_id: int = Depends(get_current_user_id)):
    questions = tutor_engine.generate_quiz(level)
    return questions

@app.post("/api/quiz/submit", response_model=UserProgressResponse)
def submit_mock_quiz(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    progress = db.query(UserProgress).filter(UserProgress.user_id == user_id).first()
    if not progress:
        raise HTTPException(status_code=404, detail="User progress profile not found")
    
    progress.quizzes_completed += 1
    progress.xp += 50
    db.commit()
    db.refresh(progress)
    return progress

# --- Text-to-Speech Streaming Fallback ---

@app.get("/api/tts")
def text_to_speech(text: str = Query(..., description="Text to convert to speech")):
    try:
        # Generate speech in memory
        tts = gTTS(text=text, lang='en', slow=False)
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return StreamingResponse(fp, media_type="audio/mp3")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
