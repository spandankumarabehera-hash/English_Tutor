import datetime
import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///tutor.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    recovery_question = Column(String, nullable=True)
    recovery_answer = Column(String, nullable=True)    # Normalized lowercase hashed answer
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    saved_words = relationship("SavedWord", back_populates="user", cascade="all, delete-orphan")
    progress = relationship("UserProgress", back_populates="user", uselist=False, cascade="all, delete-orphan")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    mode = Column(String, default="free_chat")  # free_chat, interview, restaurant, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String, nullable=False)  # "user" or "ai"
    text = Column(Text, nullable=False)
    corrected_text = Column(Text, nullable=True)  # If user sent it, the grammatically corrected version
    grammar_data = Column(Text, nullable=True)     # JSON string of detailed corrections [{error: "...", explanation: "...", suggestion: "..."}]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

class SavedWord(Base):
    __tablename__ = "saved_words"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    word = Column(String, index=True, nullable=False)
    definition = Column(Text, nullable=True)
    part_of_speech = Column(String, nullable=True)
    explanation = Column(Text, nullable=True)
    synonyms = Column(Text, nullable=True)       # JSON or comma-separated
    antonyms = Column(Text, nullable=True)       # JSON or comma-separated
    examples = Column(Text, nullable=True)       # JSON or comma-separated
    pronunciation = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="saved_words")

class UserProgress(Base):
    __tablename__ = "user_progress"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    streak = Column(Integer, default=0)
    xp = Column(Integer, default=0)
    sentences_spoken = Column(Integer, default=0)
    grammar_accuracy = Column(Float, default=100.0)
    time_spent = Column(Integer, default=0)             # in minutes
    quizzes_completed = Column(Integer, default=0)
    last_active = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="progress")

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
