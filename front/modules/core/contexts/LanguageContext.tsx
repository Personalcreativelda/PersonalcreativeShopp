import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, translations, Translations } from '../../core/services/translations';

interface LanguageContextType {
 language: Language;
 setLanguage: (lang: Language) => void;
 t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const [language, setLanguageState] = useState<Language>(() => {
 // Get saved language from localStorage or default to 'pt'
 const saved = localStorage.getItem('quintanicy_language') as Language;
 return saved && (saved === 'pt' || saved === 'en') ? saved : 'pt';
 });

 useEffect(() => {
 // Save language preference to localStorage
 localStorage.setItem('quintanicy_language', language);
 }, [language]);

 const setLanguage = (lang: Language) => {
 setLanguageState(lang);
 };

 const value: LanguageContextType = {
 language,
 setLanguage,
 t: translations[language],
 };

 return (
 <LanguageContext.Provider value={value}>
 {children}
 </LanguageContext.Provider>
 );
};

export const useLanguage = (): LanguageContextType => {
 const context = useContext(LanguageContext);
 if (!context) {
 throw new Error('useLanguage must be used within a LanguageProvider');
 }
 return context;
};


