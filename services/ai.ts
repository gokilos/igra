import { GoogleGenAI } from "@google/genai";
import { TurnHistoryItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Model selection
const MODEL_NAME = 'gemini-2.5-flash';

export const generateAISecretNumber = async (): Promise<string> => {
  // Random 4 digit string
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
};

export const generateAISecretWord = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: "Сгенерируй одно случайное существительное из 5 букв на русском языке. Только именительный падеж, единственное число. Например: ВЕТЕР, ПОЕЗД, КНИГА. В ответе напиши ТОЛЬКО само слово заглавными буквами.",
    });
    const text = response.text?.trim().toUpperCase();
    // Basic validation for Cyrillic 5 letters
    if (text && text.length === 5 && /^[А-ЯЁ]+$/.test(text)) {
        return text;
    }
    return "ИГРОК"; // Fallback
  } catch (e) {
    console.error("AI Word Gen Error", e);
    return "САХАР"; // Fallback
  }
};

export const getAIGuessForNumber = async (
  history: TurnHistoryItem[], 
  knownRevealed: (string | null)[]
): Promise<string> => {
  const previousGuesses = history
    .filter(h => h.player === 'AI')
    .map(h => h.guess)
    .join(", ");
  
  const knownState = knownRevealed.map(k => k === null ? '*' : k).join("");

  const prompt = `
    Ты играешь в игру "Угадай число".
    Цель: угадать секретный код из 4 цифр.
    
    Текущее состояние (открытые цифры): ${knownState}
    Твои предыдущие догадки: ${previousGuesses}
    
    Правила:
    - Выведи ровно 4 цифры.
    - Если цифра уже открыта (например '1**4'), ты ОБЯЗАН использовать её на этом же месте.
    - Старайся не повторять прошлые ошибочные варианты целиком.
    
    Ответ: ТОЛЬКО 4 цифры.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    let guess = response.text?.trim() || "";
    guess = guess.replace(/[^0-9]/g, '').slice(0, 4);
    
    if (guess.length !== 4) {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
    return guess;
  } catch (error) {
    console.error("AI Guess Error", error);
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
};

export const getAIGuessForWord = async (
    history: TurnHistoryItem[],
    knownRevealed: (string | null)[],
    wordLength: number
  ): Promise<string> => {
    const previousGuesses = history
      .filter(h => h.player === 'AI')
      .map(h => h.guess)
      .join(", ");
    
    const knownState = knownRevealed.map(k => k === null ? '_' : k).join("");
  
    const prompt = `
      Мы играем в слова на русском языке. Слово из ${wordLength} букв.
      Нужно угадать слово целиком.
      
      Известные буквы (открытые): ${knownState}
      Твои предыдущие попытки: ${previousGuesses}
      
      Правила:
      - Напиши одно валидное русское существительное из ${wordLength} букв.
      - Используй уже открытые буквы на своих местах.
      - Ответ пиши заглавными буквами.
      
      Ответ: ТОЛЬКО СЛОВО.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
      });
      let guess = response.text?.trim().toUpperCase() || "";
      guess = guess.replace(/[^А-ЯЁ]/g, '').slice(0, wordLength);
      
      if (guess.length !== wordLength) {
          return "АГЕНТ";
      }
      return guess;
    } catch (error) {
      console.error("AI Word Guess Error", error);
      return "АГЕНТ";
    }
  };