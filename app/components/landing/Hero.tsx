'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HomeQuizGenerator } from './HomeQuizGenerator';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export function Hero() {
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const handleQuizGenerated = (quiz: any) => {
    console.log("Quiz generated:", quiz); // Debug log
    // Only update if we have a valid quiz
    if (quiz) {
      setCurrentQuiz(quiz);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuiz && currentQuiz.questions && currentQuestionIndex < currentQuiz.questions.length - 1) {
      setCurrentQuestionIndex(prevIndex => prevIndex + 1);
      setSelectedAnswer(null);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuiz && currentQuiz.questions && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prevIndex => prevIndex - 1);
      setSelectedAnswer(null);
    }
  };

  const handleSelectAnswer = (option: string) => {
    setSelectedAnswer(option);
  };

  return (
    <div className="relative isolate overflow-hidden bg-gradient-to-b from-indigo-100/20 pt-4 sm:pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-8 sm:pb-12 lg:px-8 lg:py-12">
        <div className="text-center mb-4 sm:mb-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto max-w-3xl"
          >
            <div className="mt-2 sm:mt-4 lg:mt-2 flex justify-center">
              <a href="#" className="inline-flex space-x-6">
                <span className="rounded-full bg-indigo-600/10 px-3 py-1 text-sm font-semibold leading-6 text-indigo-600 ring-1 ring-inset ring-indigo-600/10">
                  Now Launched in Beta
                </span>
              </a>
            </div>
            <h1 className="mt-2 sm:mt-4 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
              Transform Study Materials into Interactive Quizzes
            </h1>
            <p className="mt-2 sm:mt-3 text-base sm:text-lg leading-7 sm:leading-8 text-gray-600 px-4 sm:px-0">
              Upload your PDF study materials and let our AI generate personalized quizzes. Learn smarter, not harder with QuizLab AI.
            </p>
            <div className="mt-3 sm:mt-4 flex items-center justify-center gap-x-4 sm:gap-x-6">
              <Link
                href="/auth/sign-up"
                className="rounded-md bg-indigo-600 px-3 sm:px-3.5 py-2 sm:py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                Get Started Free
              </Link>
              <Link
                href="/auth/sign-in"
                className="text-sm font-semibold leading-6 text-gray-900"
              >
                Sign In <span aria-hidden="true">→</span>
              </Link>
            </div>
          </motion.div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mt-4 sm:mt-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col justify-center"
          >
            <HomeQuizGenerator onQuizGenerated={handleQuizGenerated} />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col justify-center"
          >
            <div className="relative block rounded-xl bg-white shadow-xl ring-1 ring-gray-900/10 overflow-hidden h-full">
              <div className="p-4 sm:p-8">
                {!currentQuiz || !currentQuiz.questions || currentQuiz.questions.length === 0 ? (
                  // Default quiz display when no quiz is generated
                  <>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="text-lg sm:text-xl font-semibold text-gray-900">Example Quiz</div>
                      <div className="text-xs sm:text-sm text-gray-500">Question 2 of 3</div>
                    </div>
                    <div className="mb-6 sm:mb-8">
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">
                        Which of the following is NOT a function of the mitochondria?
                      </h3>
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-center p-2 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                          <div className="h-4 sm:h-5 w-4 sm:w-5 rounded-full border border-gray-300 mr-2 sm:mr-3"></div>
                          <span className="text-sm sm:text-base">ATP production</span>
                        </div>
                        <div className="flex items-center p-2 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                          <div className="h-4 sm:h-5 w-4 sm:w-5 rounded-full border border-gray-300 mr-2 sm:mr-3"></div>
                          <span className="text-sm sm:text-base">Cellular respiration</span>
                        </div>
                        <div className="flex items-center p-2 sm:p-3 rounded-lg border border-indigo-500 bg-indigo-50 cursor-pointer">
                          <div className="h-4 sm:h-5 w-4 sm:w-5 rounded-full bg-indigo-500 mr-2 sm:mr-3 flex items-center justify-center">
                            <svg className="h-2 sm:h-3 w-2 sm:w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <span className="text-sm sm:text-base">Protein synthesis</span>
                        </div>
                        <div className="flex items-center p-2 sm:p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                          <div className="h-4 sm:h-5 w-4 sm:w-5 rounded-full border border-gray-300 mr-2 sm:mr-3"></div>
                          <span className="text-sm sm:text-base">Calcium storage</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Previous
                      </button>
                      <button className="px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 rounded-md text-xs sm:text-sm font-medium text-white hover:bg-indigo-500">
                        Next
                      </button>
                    </div>
                  </>
                ) : currentQuiz.title === 'Generating Quiz...' ? (
                  // Loading state
                  <div className="flex flex-col items-center justify-center h-64">
                    <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mb-4" />
                    <p className="text-lg text-gray-600">Generating your quiz...</p>
                    <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                  </div>
                ) : (
                  // Generated quiz display
                  <>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <div className="text-lg sm:text-xl font-semibold text-gray-900">{currentQuiz.title || 'Generated Quiz'}</div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        Question {currentQuestionIndex + 1} of {currentQuiz.questions.length}
                      </div>
                    </div>
                    {currentQuiz.questions && currentQuiz.questions.length > 0 && currentQuestionIndex < currentQuiz.questions.length && (
                      <div className="mb-6 sm:mb-8">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-3 sm:mb-4">
                          {currentQuiz.questions[currentQuestionIndex]?.text || 'Loading question...'}
                        </h3>
                        {currentQuiz.questions[currentQuestionIndex]?.type === 'multiple_choice' && 
                         currentQuiz.questions[currentQuestionIndex]?.options && 
                         Array.isArray(currentQuiz.questions[currentQuestionIndex].options) && (
                          <div className="space-y-2 sm:space-y-3">
                            {currentQuiz.questions[currentQuestionIndex].options.map((option: string, idx: number) => {
                              if (!option) return null;
                              
                              const isSelected = selectedAnswer === option;
                              const isCorrect = selectedAnswer && option === currentQuiz.questions[currentQuestionIndex].correctAnswer;
                              
                              return (
                                <div 
                                  key={idx}
                                  onClick={() => handleSelectAnswer(option)}
                                  className={`flex items-center p-2 sm:p-3 rounded-lg border cursor-pointer
                                    ${isSelected && isCorrect ? 'border-green-500 bg-green-50' : ''}
                                    ${isSelected && !isCorrect ? 'border-red-500 bg-red-50' : ''}
                                    ${!isSelected && selectedAnswer && option === currentQuiz.questions[currentQuestionIndex].correctAnswer ? 'border-green-500 bg-green-50' : ''}
                                    ${!isSelected && !selectedAnswer ? 'border-gray-200 hover:bg-gray-50' : ''}
                                  `}
                                >
                                  <div className={`h-4 sm:h-5 w-4 sm:w-5 rounded-full mr-2 sm:mr-3 flex items-center justify-center
                                    ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border border-gray-300'}
                                    ${!isSelected && selectedAnswer && option === currentQuiz.questions[currentQuestionIndex].correctAnswer ? 'bg-green-500 border-green-500' : ''}
                                  `}>
                                    {(isSelected || (!isSelected && selectedAnswer && option === currentQuiz.questions[currentQuestionIndex].correctAnswer)) && (
                                      <svg className="h-2 sm:h-3 w-2 sm:w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-sm sm:text-base">{option}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(!currentQuiz.questions[currentQuestionIndex]?.options || 
                          !Array.isArray(currentQuiz.questions[currentQuestionIndex]?.options) ||
                          currentQuiz.questions[currentQuestionIndex]?.type !== 'multiple_choice') && (
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-gray-600">
                              {currentQuiz.questions[currentQuestionIndex]?.type === 'open_ended' 
                                ? 'This is an open-ended question. Think about your answer before revealing the solution.'
                                : 'Loading answer options...'}
                            </p>
                            {currentQuiz.questions[currentQuestionIndex]?.correctAnswer && selectedAnswer && (
                              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="font-medium">Correct Answer:</p>
                                <p>{currentQuiz.questions[currentQuestionIndex].correctAnswer}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {(!currentQuiz.questions || currentQuiz.questions.length === 0 || currentQuestionIndex >= currentQuiz.questions.length) && (
                      <div className="mb-6 sm:mb-8 p-4 bg-gray-50 rounded-lg">
                        <p className="text-center text-gray-600">
                          No questions available yet.
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <button 
                        onClick={handlePreviousQuestion}
                        disabled={currentQuestionIndex === 0 || !currentQuiz.questions || currentQuiz.questions.length === 0}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium ${currentQuestionIndex === 0 || !currentQuiz.questions || currentQuiz.questions.length === 0 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        Previous
                      </button>
                      <button 
                        onClick={handleNextQuestion}
                        disabled={!currentQuiz.questions || currentQuiz.questions.length === 0 || currentQuestionIndex >= currentQuiz.questions.length - 1}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium text-white ${!currentQuiz.questions || currentQuiz.questions.length === 0 || currentQuestionIndex >= currentQuiz.questions.length - 1 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                      >
                        Next
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
} 