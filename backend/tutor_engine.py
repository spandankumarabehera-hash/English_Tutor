import os
import json
import logging
import urllib.request
import urllib.parse
from typing import List, Tuple, Dict, Any
from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel, Field

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Expanded Dictionary Database
MOCK_DICTIONARY = {
    "fluent": {
        "word": "fluent",
        "definition": "Able to express oneself easily and articulately.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe someone who speaks or writes a language easily, smoothly, and naturally.",
        "synonyms": ["eloquent", "articulate", "expressive", "smooth"],
        "antonyms": ["hesitant", "inarticulate", "stuttering", "broken"],
        "pronunciation": "/ˈfluːənt/",
        "examples": [
            "She is fluent in three languages: English, French, and Japanese.",
            "His English has become much more fluent after practicing with an AI tutor.",
            "To be fluent, you need to practice speaking daily."
        ]
    },
    "gargantuan": {
        "word": "gargantuan",
        "definition": "Enormous, gigantic, colossal.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe something that is extremely large in size, volume, or quantity.",
        "synonyms": ["huge", "massive", "gigantic", "immense"],
        "antonyms": ["tiny", "minuscule", "microscopic", "small"],
        "pronunciation": "/ɡɑːˈɡæntʃuən/",
        "examples": [
            "The project required a gargantuan effort from the entire team.",
            "A gargantuan wave crashed against the futuristic shoreline.",
            "The vocabulary dictionary contains a gargantuan amount of words."
        ]
    },
    "convoluted": {
        "word": "convoluted",
        "definition": "Extremely complex and difficult to follow.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe arguments, sentences, or paths that are so twisted and complicated they confuse you.",
        "synonyms": ["complex", "complicated", "intricate", "tangled"],
        "antonyms": ["simple", "straightforward", "lucid", "clear"],
        "pronunciation": "/ˌkɒnvəˈluːtɪd/",
        "examples": [
            "His explanation was so convoluted that nobody in the class understood it.",
            "The movie had a convoluted plot with too many unexpected twists.",
            "I am trying to simplify my convoluted sentence structure."
        ]
    },
    "parsimonious": {
        "word": "parsimonious",
        "definition": "Extremely unwilling to spend money; stingy or frugal.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe someone who is very careful with money, often to an extreme or cheap level.",
        "synonyms": ["stingy", "frugal", "tightfisted", "miserly"],
        "antonyms": ["generous", "profligate", "extravagant", "lavish"],
        "pronunciation": "/ˌpɑːsɪˈməʊniəs/",
        "examples": [
            "He is so parsimonious that he refuses to buy a new coat even in winter.",
            "The company's parsimonious budget restricted any new projects.",
            "We should be economical, but not parsimonious."
        ]
    },
    "eloquent": {
        "word": "eloquent",
        "definition": "Fluent or persuasive in speaking or writing.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe someone who speaks beautifully and effectively, moving people's emotions.",
        "synonyms": ["fluent", "articulate", "persuasive", "expressive"],
        "antonyms": ["inarticulate", "hesitant", "clumsy", "dull"],
        "pronunciation": "/ˈɛləkwənt/",
        "examples": [
            "She delivered an eloquent speech that inspired everyone in the room.",
            "His writing style is highly eloquent and poetic.",
            "An eloquent speaker can easily win arguments."
        ]
    },
    "magnanimous": {
        "word": "magnanimous",
        "definition": "Very generous or forgiving, especially toward a rival.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe someone who has a big heart and forgives others easily, showing noble character.",
        "synonyms": ["generous", "forgiving", "noble", "charitable"],
        "antonyms": ["petty", "mean", "spiteful", "vindictive"],
        "pronunciation": "/mæɡˈnænɪməs/",
        "examples": [
            "He was magnanimous in defeat, warmly congratulating the winner.",
            "It was highly magnanimous of her to forgive his mistakes.",
            "A great leader must be magnanimous to bring unity."
        ]
    },
    "lucid": {
        "word": "lucid",
        "definition": "Expressed clearly; easy to understand.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe explanations, thoughts, or writing that are very clear and easy to follow.",
        "synonyms": ["clear", "comprehensible", "transparent", "plain"],
        "antonyms": ["confusing", "ambiguous", "convoluted", "vague"],
        "pronunciation": "/ˈluːsɪd/",
        "examples": [
            "The teacher gave a lucid explanation of the complex grammar rule.",
            "She had a lucid dream where she could fly over the ocean.",
            "Please write your essays in a simple and lucid style."
        ]
    },
    "ambiguous": {
        "word": "ambiguous",
        "definition": "Open to more than one interpretation; having a double meaning.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe statements, signs, or commands that are unclear and can be understood in different ways.",
        "synonyms": ["unclear", "equivocal", "vague", "uncertain"],
        "antonyms": ["clear", "unambiguous", "lucid", "explicit"],
        "pronunciation": "/æmˈbɪɡjuəs/",
        "examples": [
            "The laws are somewhat ambiguous, leading to different interpretations.",
            "Her text message was ambiguous, and I didn't know if she was joking.",
            "Try to avoid ambiguous phrasing in your writing."
        ]
    },
    "redundant": {
        "word": "redundant",
        "definition": "Not or no longer needed or useful; superfluous.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe something that is repeated unnecessarily (like saying 'free gift' because gifts are always free).",
        "synonyms": ["superfluous", "unnecessary", "repetitive", "excessive"],
        "antonyms": ["essential", "necessary", "required", "concise"],
        "pronunciation": "/rɪˈdʌndənt/",
        "examples": [
            "The programmer removed the redundant lines of code.",
            "Saying 'I returned back' is redundant; just say 'I returned'.",
            "This document is redundant as we already have an updated version."
        ]
    },
    "frugal": {
        "word": "frugal",
        "definition": "Sparing or economical with regard to money or food.",
        "part_of_speech": "adjective",
        "explanation": "Used to describe a simple, economical lifestyle where a person avoids spending money unnecessarily.",
        "synonyms": ["economical", "thrifty", "careful", "saving"],
        "antonyms": ["wasteful", "extravagant", "lavish", "spendthrift"],
        "pronunciation": "/ˈfruːɡəl/",
        "examples": [
            "He lives a frugal life in a tiny cabin in the woods.",
            "By being frugal, they saved enough money to travel the world.",
            "She cooked a delicious and frugal meal using simple leftovers."
        ]
    }
}

# Mock questions database
MOCK_QUIZZES = {
    "beginner": [
        {
            "id": 1,
            "question": "I __________ to the park yesterday.",
            "choices": ["go", "goes", "went", "going"],
            "correct_answer": "went",
            "explanation": "Since the action occurred 'yesterday' (past tense), you should use the simple past tense form of the verb 'go', which is 'went'."
        },
        {
            "id": 2,
            "question": "She is my friend. __________ name is Clara.",
            "choices": ["His", "Her", "Their", "Its"],
            "correct_answer": "Her",
            "explanation": "Clara is female, so we use the female possessive adjective 'Her'."
        },
        {
            "id": 3,
            "question": "They __________ playing soccer in the garden right now.",
            "choices": ["is", "am", "are", "was"],
            "correct_answer": "are",
            "explanation": "With the plural pronoun 'They' in the present continuous tense, we use the plural auxiliary verb 'are'."
        },
        {
            "id": 4,
            "question": "I would like __________ apple from the basket.",
            "choices": ["a", "an", "the", "some"],
            "correct_answer": "an",
            "explanation": "We use the indefinite article 'an' before singular count nouns that begin with vowel sounds (a, e, i, o, u). 'Apple' starts with the vowel sound /æ/."
        },
        {
            "id": 5,
            "question": "How __________ milk do we need for the cake?",
            "choices": ["many", "much", "few", "any"],
            "correct_answer": "much",
            "explanation": "'Milk' is an uncountable noun. We use 'how much' for uncountable nouns and 'how many' for countable nouns."
        }
    ],
    "intermediate": [
        {
            "id": 1,
            "question": "If I __________ you, I would study daily.",
            "choices": ["am", "was", "were", "would be"],
            "correct_answer": "were",
            "explanation": "This is a Second Conditional sentence (hypothetical). In formal English, we use 'were' instead of 'was' for all subjects in the conditional clause."
        },
        {
            "id": 2,
            "question": "She has been working here __________ three years.",
            "choices": ["since", "for", "during", "ago"],
            "correct_answer": "for",
            "explanation": "We use 'for' to describe a duration of time (three years), whereas we use 'since' to mark a specific starting point in time (e.g. since 2023)."
        },
        {
            "id": 3,
            "question": "He avoided __________ his homework by playing video games.",
            "choices": ["do", "to do", "doing", "did"],
            "correct_answer": "doing",
            "explanation": "The verb 'avoid' is always followed by a gerund (verb ending in '-ing'), not an infinitive."
        },
        {
            "id": 4,
            "question": "By next year, I __________ my English graduation course.",
            "choices": ["will finish", "will have finished", "finished", "have finished"],
            "correct_answer": "will have finished",
            "explanation": "This sentence refers to an action that will be completed before a specific point in the future ('by next year'). Thus, we use the Future Perfect tense: 'will have finished'."
        },
        {
            "id": 5,
            "question": "That is the teacher __________ daughter won the spelling bee.",
            "choices": ["who", "whom", "which", "whose"],
            "correct_answer": "whose",
            "explanation": "We use the relative pronoun 'whose' to indicate possession (the daughter belonging to the teacher)."
        }
    ],
    "advanced": [
        {
            "id": 1,
            "question": "It is imperative that the student __________ present at the examination.",
            "choices": ["is", "be", "was", "would be"],
            "correct_answer": "be",
            "explanation": "This sentence utilizes the present subjunctive mood (triggered by 'It is imperative that...'). The subjunctive requires the base form of the verb, which is 'be' for the verb 'to be'."
        },
        {
            "id": 2,
            "question": "Hardly __________ walked into the office when the phone started ringing.",
            "choices": ["I had", "had I", "I have", "did I"],
            "correct_answer": "had I",
            "explanation": "This is a sentence inversion triggered by starting with a negative adverb ('Hardly'). When a sentence starts with 'Hardly' or 'Scarcely', it is followed by inverted auxiliary verb-subject structure: 'had I'."
        },
        {
            "id": 3,
            "question": "Her explanation was so __________ that nobody could understand it.",
            "choices": ["lucid", "convoluted", "perspicuous", "cogent"],
            "correct_answer": "convoluted",
            "explanation": "The context specifies 'nobody could understand it'. Therefore, we need an adjective meaning complicated or difficult to follow, which is 'convoluted'."
        },
        {
            "id": 4,
            "question": "The manager recommended that the proposal __________ reviewed by the committee.",
            "choices": ["should", "is", "be", "was"],
            "correct_answer": "be",
            "explanation": "This is a subjunctive construct following the verb 'recommended'. Subjunctive verbs require the base form (be reviewed), which serves as a passive subjunctive here."
        },
        {
            "id": 5,
            "question": "He has a reputation for being rather __________; he never spends money.",
            "choices": ["generous", "profligate", "parsimonious", "magnanimous"],
            "correct_answer": "parsimonious",
            "explanation": "'Parsimonious' means extremely unwilling to spend money; frugal or stingy, which matches the context."
        }
    ]
}

def fetch_from_public_dictionary(word: str) -> Dict[str, Any]:
    word_clean = word.strip().lower()
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(word_clean)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            if isinstance(data, list) and len(data) > 0:
                entry = data[0]
                meanings = entry.get("meanings", [])
                
                definition = "A beautiful English word."
                part_of_speech = "noun"
                synonyms = []
                antonyms = []
                examples = []
                
                if meanings:
                    first_meaning = meanings[0]
                    part_of_speech = first_meaning.get("partOfSpeech", "noun")
                    defs = first_meaning.get("definitions", [])
                    if defs:
                        definition = defs[0].get("definition", definition)
                        for d in defs:
                            if d.get("example"):
                                examples.append(d.get("example"))
                    
                    for m in meanings:
                        syns = m.get("synonyms", [])
                        if syns:
                            synonyms.extend(syns)
                        ants = m.get("antonyms", [])
                        if ants:
                            antonyms.extend(ants)
                
                synonyms = list(set(synonyms))[:4]
                antonyms = list(set(antonyms))[:3]
                
                phonetics = entry.get("phonetics", [])
                pronunciation = f"/{word_clean}/"
                for p in phonetics:
                    if p.get("text"):
                        pronunciation = p.get("text")
                        break
                
                if not examples:
                    examples = [
                        f"We discussed the word '{word_clean}' during our tutoring session.",
                        f"It is important to learn the exact meaning of '{word_clean}'."
                    ]
                else:
                    examples = list(set(examples))[:3]
                
                explanation = f"This word is used as a {part_of_speech}. It means: {definition}"
                
                return {
                    "word": word_clean,
                    "definition": definition,
                    "part_of_speech": part_of_speech,
                    "explanation": explanation,
                    "synonyms": synonyms,
                    "antonyms": antonyms,
                    "examples": examples,
                    "pronunciation": pronunciation
                }
    except Exception as e:
        logger.error(f"Error calling public dictionary API: {e}")
    return {}

# Fallback/Mock system for when Gemini API Key is missing or invalid
class MockTutorEngine:
    @staticmethod
    def get_tutor_response(message: str, history: List[Dict[str, str]], mode: str = "free_chat") -> str:
        msg = message.strip()
        msg_lower = msg.lower().replace(".", "").replace(",", "").replace("!", "").replace("?", "")

        # 1. Handle silent initialization triggers
        if not msg or msg.startswith("initialize "):
            if mode == "interview":
                return "Welcome to the job interview practice session! I am your interviewer today. Let's start. 'Could you please introduce yourself and tell me why you are interested in this position?'"
            elif mode == "restaurant":
                return "Welcome to our futuristic bistro! I will be your server. What can I get started for you today? We have excellent cosmic coffees and starlight salads."
            elif mode == "airport":
                return "Hello! Welcome to the airline check-in counter. May I please see your passport and ticket to start checking you in?"
            else:
                return "Hello! I am your friendly English AI Tutor. How is your day going? Would you like to practice speaking, focus on grammar, or lookup some vocabulary today?"

        # 2. Intercept dictionary inquiries inside chat
        intercept_words = ["define ", "meaning of ", "what does ", "what is the meaning of "]
        target_word = None
        for iw in intercept_words:
            if iw in msg_lower:
                parts = msg_lower.split(iw)
                if len(parts) > 1:
                    target_word = parts[1].strip().replace("mean", "").strip()
                    break
        
        if target_word:
            vocab = MockTutorEngine.lookup_dictionary(target_word)
            if vocab.get("definition") and "meaning" not in vocab.get("definition"):
                return (
                    f"Of course! The word **'{vocab['word']}'** is a **{vocab['part_of_speech']}**.\n\n"
                    f"**Meaning**: {vocab['definition']}\n"
                    f"**Simple Explanation**: {vocab['explanation']}\n"
                    f"**Example**: \"{vocab['examples'][0]}\"\n\n"
                    f"It is a beautiful vocabulary word! Is there any other word you want to practice or discuss?"
                )

        # 3. Conversational responses with simple natural keyword matchers
        greetings_keywords = ["hello", "hi", "hey", "hlo", "sir", "good morning", "good afternoon", "good evening"]
        is_greeting = any(gk in msg_lower for gk in greetings_keywords)
        if is_greeting:
            greeting_replies = [
                "Hello there! It is wonderful to speak with you today. How is your English learning journey going?",
                "Hi! I am your friendly English AI Tutor. What is on your mind, and how can I help you practice today?",
                "Hey! Let's practice some conversation. Tell me about your day or what you did yesterday!",
                "Greetings! I am excited to help you practice English today. Are you ready for some fun language exercises?"
            ]
            g_idx = len(history) % len(greeting_replies)
            return greeting_replies[g_idx]

        if "how are you" in msg_lower:
            return "I am doing exceptionally well, thank you for asking! I am excited to help you practice English today. How are you feeling?"

        if "weather" in msg_lower:
            return "The weather here in our digital tutor space is always perfect! How is the weather where you are living? Is it sunny or rainy?"

        if "interview" in msg_lower or mode == "interview":
            if "myself" in msg_lower or "name" in msg_lower or "experience" in msg_lower:
                return "That sounds like a very solid background! What do you consider to be your greatest professional strength, and how does it help you in this role?"
            return "Excellent point. How do you handle stressful situations or deadlines at work? Can you give me an example?"

        if "restaurant" in msg_lower or mode == "restaurant":
            if "order" in msg_lower or "coffee" in msg_lower or "salad" in msg_lower or "please" in msg_lower:
                return "Great choice! Would you like that to go, or will you be dining in with us today? And would you like any pastries to accompany that?"
            return "Certainly! I will have that ready for you in just a few minutes. Is there anything else I can assist you with?"

        if "airport" in msg_lower or mode == "airport":
            if "passport" in msg_lower or "here" in msg_lower or "ticket" in msg_lower:
                return "Thank you. Everything looks correct. Are you checking any bags today, or do you only have carry-on luggage?"
            return "Perfect. Here is your boarding pass. Your gate is B12, and boarding starts in 30 minutes. Have a wonderful flight!"

        if "help" in msg_lower or "practice" in msg_lower:
            return "I'm here to help you practice speaking and writing! You can write a paragraph about your day, or we can roleplay. What sounds like fun to you?"

        # General supportive conversation (no echoing!)
        replies = [
            "That is very interesting! Can you tell me more about that or explain it in a different way to help practice your tenses?",
            "I see. That makes perfect sense! Let's build on that: how do you usually spend your free time when you're not studying English?",
            "Great phrasing! Your sentence is grammatically correct. What are some of your long-term goals for improving your English speaking confidence?",
            "I appreciate you sharing that! By the way, is there any specific word or topic you'd like us to focus on in our chat today?"
        ]
        
        # Calculate next reply using message length and history length offset
        idx = (len(msg_lower) + len(history) * 3) % len(replies)
        
        # Avoid back-to-back repetitions if history is present
        if history:
            last_ai_text = history[-1]["text"] if history[-1]["sender"] == "ai" else ""
            if last_ai_text == replies[idx]:
                idx = (idx + 1) % len(replies)
                
        return replies[idx]

    @staticmethod
    def correct_grammar(message: str) -> Dict[str, Any]:
        msg = message.strip()
        msg_lower = msg.lower().replace(".", "").replace(",", "").replace("!", "")
        
        corrections = []
        is_correct = True
        corrected_text = msg

        if "i goes" in msg_lower:
            is_correct = False
            corrected_text = msg.replace("goes", "go")
            corrections.append({
                "error": "goes",
                "replacement": "go",
                "explanation": "With the first-person singular pronoun 'I', we use the base form of the verb 'go', not the third-person 'goes'."
            })
        elif "he go " in msg_lower or msg_lower == "he go":
            is_correct = False
            corrected_text = msg.replace("go", "goes")
            corrections.append({
                "error": "go",
                "replacement": "goes",
                "explanation": "With third-person singular pronouns (he, she, it), we add '-s' or '-es' to the verb. So 'he go' becomes 'he goes'."
            })
        elif "she do " in msg_lower or msg_lower == "she do":
            is_correct = False
            corrected_text = msg.replace("do", "does")
            corrections.append({
                "error": "do",
                "replacement": "does",
                "explanation": "With third-person singular (he, she, it), the verb 'do' changes to 'does'."
            })
        elif "yesterday i buy" in msg_lower:
            is_correct = False
            corrected_text = msg.replace("buy", "bought")
            corrections.append({
                "error": "buy",
                "replacement": "bought",
                "explanation": "Since the action happened 'yesterday' (past tense), you should use the past tense of 'buy', which is 'bought'."
            })
        
        return {
            "is_correct": is_correct,
            "corrected_text": corrected_text,
            "corrections": corrections
        }

    @staticmethod
    def lookup_dictionary(word: str) -> Dict[str, Any]:
        word_clean = word.strip().lower().replace(".", "").replace(",", "").replace("?", "")
        
        if word_clean in MOCK_DICTIONARY:
            return MOCK_DICTIONARY[word_clean]
        
        # Try public API lookup!
        public_data = fetch_from_public_dictionary(word_clean)
        if public_data:
            return public_data
        
        return {
            "word": word,
            "definition": f"A word meaning '{word}'.",
            "part_of_speech": "noun/verb/adjective",
            "explanation": f"This is an interesting English word! You can search words like 'fluent', 'eloquent', 'lucid', or 'convoluted' to see detailed examples.",
            "synonyms": ["similar_word_1", "similar_word_2"],
            "antonyms": ["opposite_word_1"],
            "pronunciation": f"/{word}/",
            "examples": [
                f"This is an example sentence using the word {word}.",
                f"Learning the word '{word}' is part of building your English vocabulary."
            ]
        }

    @staticmethod
    def generate_quiz(level: str) -> List[Dict[str, Any]]:
        clean_level = level.lower().strip()
        return MOCK_QUIZZES.get(clean_level, MOCK_QUIZZES["beginner"])

# Structured response schemas for Gemini API
class CorrectionItemSchema(BaseModel):
    error: str = Field(description="The exact incorrect word, phrase, or spelling error in the user's sentence.")
    replacement: str = Field(description="The corrected or more fluent alternative.")
    explanation: str = Field(description="A short, clear, friendly explanation of why the original was incorrect and why the replacement is better.")

class GrammarCorrectionSchema(BaseModel):
    is_correct: bool = Field(description="True if the user's text is 100% correct grammatically and naturally. False if there are errors, awkward phrases, or spelling issues.")
    corrected_text: str = Field(description="The fully corrected, natural, and highly fluent version of the user's text.")
    corrections: List[CorrectionItemSchema] = Field(description="List of individual corrections. Empty if the user's text was correct.")

class DictionaryLookupSchema(BaseModel):
    word: str = Field(description="The target word or phrase being looked up.")
    definition: str = Field(description="A clear and accurate standard dictionary definition.")
    part_of_speech: str = Field(description="The part of speech (noun, verb, adjective, adverb, etc.).")
    explanation: str = Field(description="An easy, simple, child-friendly explanation of what the word means and how to think about it.")
    synonyms: List[str] = Field(description="3-5 synonyms (words with similar meanings).")
    antonyms: List[str] = Field(description="2-4 antonyms (words with opposite meanings).")
    examples: List[str] = Field(description="3 realistic, helpful example sentences illustrating the word in modern conversational context.")
    pronunciation: str = Field(description="Phonetic spelling or pronunciation guide (e.g. IPA or phonetic spelling).")

class QuizQuestionSchema(BaseModel):
    id: int = Field(description="Question index 1 to 5")
    question: str = Field(description="The English grammar or vocabulary multiple choice question text.")
    choices: List[str] = Field(description="4 distinct multiple choice answers.")
    correct_answer: str = Field(description="The exact choice text which is the correct answer.")
    explanation: str = Field(description="A detailed friendly explanation of why this answer is correct and why other choices are wrong.")

class QuizResponseSchema(BaseModel):
    level: str = Field(description="English skill level (beginner, intermediate, advanced)")
    questions: List[QuizQuestionSchema] = Field(description="List of exactly 5 multiple choice questions")


class GeminiTutorEngine:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.use_mock = not self.api_key or "YOUR_GEMINI_API_KEY" in self.api_key
        self.client = None
        
        if not self.use_mock:
            try:
                self.client = genai.Client(api_key=self.api_key)
                logger.info("Successfully initialized Gemini GenAI Client.")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini GenAI Client: {e}. Falling back to mock mode.")
                self.use_mock = True
        else:
            logger.info("No Gemini API key set or placeholder detected. Running in mock mode.")

    def get_tutor_response(self, message: str, history: List[Dict[str, str]], mode: str = "free_chat") -> str:
        if self.use_mock:
            return MockTutorEngine.get_tutor_response(message, history, mode)

        try:
            formatted_contents = []
            
            system_instruction = (
                "You are an encouraging, highly professional, and friendly English Tutor named 'English AI Tutor'.\n"
                "Your objective is to converse naturally with the student to help improve their conversational confidence.\n"
                "Keep your responses concise, interesting, and engaging (usually 2-4 sentences, fit for a messaging UI).\n"
                "Ask a follow-up question or suggest a new sub-topic occasionally to keep the conversation flowing.\n"
                "Do NOT point out grammar errors in this conversational reply! A separate dedicated grammar parser runs alongside you to explain spelling/grammar mistakes to the user. Your role is purely to hold a pleasant, encouraging conversation like a real, supportive human teacher.\n"
                "If the user asks for a word definition (e.g., 'define eloquent' or 'meaning of parsimonious'), explain it beautifully inside the chat in simple terms and encourage them to practice using it."
            )
            
            if mode == "interview":
                system_instruction += "SCENARIO: This is a professional Job Interview practice. Act as a friendly but formal corporate interviewer. Ask relevant questions step-by-step."
            elif mode == "restaurant":
                system_instruction += "SCENARIO: This is a Restaurant roleplay. Act as a waiter at a busy coffee shop or bistro. Help the user order and suggest menu items."
            elif mode == "airport":
                system_instruction += "SCENARIO: This is an Airport Check-in roleplay. Act as the airline customer service agent checking the user's passport, bags, and boarding pass."
            elif mode == "casual":
                system_instruction += "SCENARIO: This is a Casual Chat about hobbies, food, travel, and goals. Act as a supportive friend."

            for h in history[-8:]:
                role = "user" if h["sender"] == "user" else "model"
                formatted_contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=h["text"])]
                ))
            
            if message:
                formatted_contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=message)]
                ))
            else:
                formatted_contents.append(types.Content(
                    role="user",
                    parts=[types.Part.from_text(text="Hello! Let's start.")]
                ))

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
                max_output_tokens=300
            )

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=formatted_contents,
                config=config
            )
            
            return response.text.strip()
            
        except Exception as e:
            logger.error(f"Error in Gemini tutor generation: {e}. Falling back to mock mode.")
            return MockTutorEngine.get_tutor_response(message, history, mode)

    def correct_grammar(self, message: str) -> Dict[str, Any]:
        if self.use_mock:
            return MockTutorEngine.correct_grammar(message)

        try:
            prompt = (
                f"Analyze the following user-submitted English sentence for grammar, spelling, punctuation, and style.\n"
                f"User Sentence: \"{message}\"\n\n"
                f"Identify all issues and provide structured output matching the response schema."
            )

            config = types.GenerateContentConfig(
                system_instruction=(
                    "You are an expert English Language Professor. Your job is to check the user's sentence for errors, "
                    "correct them politely, provide highly natural alternatives, and explain the grammatical reasoning "
                    "in simple, easy-to-understand terms. Be very accurate and encouraging."
                ),
                response_mime_type="application/json",
                response_schema=GrammarCorrectionSchema,
                temperature=0.1
            )

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config
            )
            
            data = json.loads(response.text)
            return data

        except Exception as e:
            logger.error(f"Error in Gemini grammar correction: {e}. Falling back to mock engine.")
            return MockTutorEngine.correct_grammar(message)

    def lookup_dictionary(self, word: str) -> Dict[str, Any]:
        if self.use_mock:
            return MockTutorEngine.lookup_dictionary(word)

        try:
            prompt = (
                f"Provide complete dictionary information for the word or phrase: \"{word}\".\n"
                f"Include its meaning, synonyms, antonyms, pronunciation key, a simple friendly explanation, and 3 example sentences."
            )

            config = types.GenerateContentConfig(
                system_instruction=(
                    "You are a helpful and detailed English dictionary assistant. Provide comprehensive, friendly vocabulary "
                    "information. Ensure all parts of the response are clear, accurate, and highly educational."
                ),
                response_mime_type="application/json",
                response_schema=DictionaryLookupSchema,
                temperature=0.2
            )

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config
            )
            
            data = json.loads(response.text)
            return data

        except Exception as e:
            logger.error(f"Error in Gemini dictionary lookup: {e}. Falling back to mock engine.")
            return MockTutorEngine.lookup_dictionary(word)

    def generate_quiz(self, level: str) -> List[Dict[str, Any]]:
        if self.use_mock:
            return MockTutorEngine.generate_quiz(level)

        try:
            prompt = (
                f"Generate a challenging, highly educational multiple choice quiz with exactly 5 questions "
                f"to test a student at English proficiency level: '{level}'.\n"
                f"Ensure the choices test diverse tenses, word forms, or active vocabulary. Output should strictly match the response schema."
            )

            config = types.GenerateContentConfig(
                system_instruction=(
                    "You are a master English examiner. Generate a beautifully constructed English multiple choice grammar "
                    "and vocabulary quiz. Ensure each question has exactly 4 distinct choices, with 1 correct option. "
                    "Provide highly supportive explanations detailing why the correct answer fits and why others fail."
                ),
                response_mime_type="application/json",
                response_schema=QuizResponseSchema,
                temperature=0.4
            )

            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=config
            )
            
            data = json.loads(response.text)
            return data.get("questions", [])

        except Exception as e:
            logger.error(f"Error in Gemini quiz generation: {e}. Falling back to mock quiz engine.")
            return MockTutorEngine.generate_quiz(level)


tutor_engine = GeminiTutorEngine()
