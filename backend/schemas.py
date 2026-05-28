from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=4)
    recovery_question: str = Field(..., description="Selected security question")
    recovery_answer: str = Field(..., description="Answer to security question")

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    user_id: int
    username: str
    message: str

class RecoveryQuestionResponse(BaseModel):
    username: str
    recovery_question: str

class ResetPasswordRequest(BaseModel):
    username: str
    recovery_answer: str
    new_password: str = Field(..., min_length=4)

class RecoverUsernameRequest(BaseModel):
    recovery_question: str
    recovery_answer: str

class MessageCreate(BaseModel):
    text: str
    session_id: str
    mode: Optional[str] = "free_chat"

class CorrectionItem(BaseModel):
    error: str = Field(description="The incorrect word or phrase in the user's sentence")
    replacement: str = Field(description="The corrected, more fluent alternative")
    explanation: str = Field(description="Explanation of why the original was incorrect and why the replacement is better")

class GrammarCorrectionResponse(BaseModel):
    is_correct: bool = Field(description="Whether the user's input is grammatically correct")
    corrected_text: Optional[str] = Field(None, description="The fully corrected and polished version of the user's text")
    corrections: List[CorrectionItem] = Field(default=[], description="List of individual corrections made")

class MessageResponse(BaseModel):
    id: int
    session_id: str
    sender: str
    text: str
    corrected_text: Optional[str] = None
    grammar_data: Optional[str] = None  # JSON string containing details
    created_at: datetime

    class Config:
        from_attributes = True

class ChatSessionCreate(BaseModel):
    id: str
    title: str
    mode: Optional[str] = "free_chat"

class ChatSessionResponse(BaseModel):
    id: str
    user_id: int
    title: str
    mode: str
    created_at: datetime

    class Config:
        from_attributes = True

class DictionaryLookupRequest(BaseModel):
    word: str

class DictionaryLookupResponse(BaseModel):
    word: str
    definition: str
    part_of_speech: str
    explanation: str
    synonyms: List[str]
    antonyms: List[str]
    examples: List[str]
    pronunciation: Optional[str] = None

class VocabularySaveRequest(BaseModel):
    word: str
    definition: str
    part_of_speech: str
    explanation: str
    synonyms: List[str]
    antonyms: List[str]
    examples: List[str]
    pronunciation: Optional[str] = None

class VocabularyResponse(BaseModel):
    id: int
    user_id: int
    word: str
    definition: Optional[str] = None
    part_of_speech: Optional[str] = None
    explanation: Optional[str] = None
    synonyms: Optional[str] = None
    antonyms: Optional[str] = None
    examples: Optional[str] = None
    pronunciation: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserProgressResponse(BaseModel):
    streak: int
    xp: int
    sentences_spoken: int
    grammar_accuracy: float
    time_spent: int
    quizzes_completed: int

    class Config:
        from_attributes = True

class QuizQuestion(BaseModel):
    id: int = Field(description="Question ID from 1 to 5")
    question: str = Field(description="The clear English question text (e.g. fill in the blank or grammar identification)")
    choices: List[str] = Field(description="4 multiple-choice options")
    correct_answer: str = Field(description="The exact text of the correct choice")
    explanation: str = Field(description="An encouraging, polite explanation of why this answer is correct and why the others are wrong")

class QuizResponse(BaseModel):
    level: str
    questions: List[QuizQuestion]
