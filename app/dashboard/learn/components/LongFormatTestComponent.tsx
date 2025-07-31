import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, ArrowLeft, RotateCcw, Trophy, Target, Clock } from 'lucide-react';
import { useSupabase } from '@/utils/supabase/client';
import { useAuth } from '@/app/providers/AuthProvider';
import { useToast } from '@/components/ui/use-toast';
import { v4 as uuidv4 } from 'uuid';

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[];
  correctAnswer: string;
  quizId?: string;
  quizTitle?: string;
}

interface QuestionResult {
  question_id: string;
  quiz_id?: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  question_text: string;
  options: string[];
  type: string;
}

interface LongFormatTestProps {
  questions: Question[];
  title?: string;
  onBack: () => void;
  onComplete?: () => void;
}

export function LongFormatTestComponent({ questions, title, onBack, onComplete }: LongFormatTestProps) {
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{
    score: number;
    totalQuestions: number;
    questionResults: QuestionResult[];
  } | null>(null);
  const [startTime] = useState(Date.now());
  const [timeSpent, setTimeSpent] = useState(0);
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const { toast } = useToast();

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const submitTest = async () => {
    if (!user || !supabase) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save your test results.',
        variant: 'destructive',
      });
      return;
    }
    try {
      setIsSubmitting(true);
      let score = 0;
      const questionResults: QuestionResult[] = [];
      questions.forEach(question => {
        const userAnswer = userAnswers[question.id] || '';
        let isCorrect = false;
        if (question.type === 'multiple_choice' && question.options) {
          if (userAnswer === question.correctAnswer) {
            isCorrect = true;
          } else {
            const answerLetter = question.correctAnswer.trim().toUpperCase();
            if (answerLetter.match(/^[A-D]$/)) {
              const letterIndex = answerLetter.charCodeAt(0) - 65;
              if (question.options[letterIndex] === userAnswer) {
                isCorrect = true;
              }
            } else {
              const cleanUserAnswer = userAnswer.trim().toLowerCase();
              const cleanCorrectAnswer = question.correctAnswer.trim().toLowerCase();
              const cleanedCorrectAnswer = cleanCorrectAnswer.replace(/^[a-d]\)\s*/i, '');
              const cleanedUserAnswer = cleanUserAnswer.replace(/^[a-d]\)\s*/i, '');
              if (cleanedUserAnswer === cleanedCorrectAnswer) {
                isCorrect = true;
              }
            }
          }
        } else {
          const cleanUserAnswer = userAnswer.trim().toLowerCase();
          const cleanCorrectAnswer = question.correctAnswer.trim().toLowerCase();
          isCorrect = cleanUserAnswer === cleanCorrectAnswer;
        }
        if (isCorrect) score++;
        questionResults.push({
          question_id: question.id,
          quiz_id: question.quizId,
          user_answer: userAnswer,
          correct_answer: question.correctAnswer,
          is_correct: isCorrect,
          question_text: question.text,
          options: question.options || [],
          type: question.type || 'open_ended'
        });
      });
      const totalQuestions = questions.length;
      const finalTimeSpent = Math.floor((Date.now() - startTime) / 1000);
      setResults({ score, totalQuestions, questionResults });
      setShowResults(true);
      // Save as exam_result
      const examResult = {
        id: uuidv4(),
        user_id: user.id,
        exam_id: null, // Not a formal exam, but for analytics
        score,
        total_questions: totalQuestions,
        question_results: questionResults,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      await supabase.from('exam_results').insert(examResult);
      toast({
        title: 'Test completed!',
        description: `You scored ${score} out of ${totalQuestions} (${Math.round((score/totalQuestions)*100)}%)`,
      });
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Error submitting test:', error);
      toast({
        title: 'Error submitting test',
        description: 'There was a problem processing your answers.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (showResults && results) {
    const percentage = Math.round((results.score / results.totalQuestions) * 100);
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Test Completed!</CardTitle>
            <CardDescription>
              You scored {results.score} out of {results.totalQuestions} questions correctly
            </CardDescription>
            <div className="flex justify-center items-center space-x-4 mt-4">
              <Badge className="text-lg px-4 py-2">
                {percentage}%
              </Badge>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="h-4 w-4 mr-1" />
                {formatTime(timeSpent)}
              </div>
            </div>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Question Review</CardTitle>
            <CardDescription>Review your answers and see the correct solutions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.questionResults.map((result, index) => {
              const question = questions.find(q => q.id === result.question_id);
              if (!question) return null;
              return (
                <div key={result.question_id} className={`p-4 rounded-lg border-l-4 ${result.is_correct ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">Question {index + 1}</h4>
                    {result.is_correct ? (
                      <div className="flex items-center text-green-600">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm">Correct</span>
                      </div>
                    ) : (
                      <div className="flex items-center text-red-600">
                        <XCircle className="h-4 w-4 mr-1" />
                        <span className="text-sm">Incorrect</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm mb-3">{question.text}</p>
                  {question.type === 'multiple_choice' && question.options && (
                    <div className="space-y-1 text-sm">
                      {question.options.map((option, optionIndex) => {
                        const isUserSelected = option === result.user_answer;
                        const isCorrectOption = option === result.correct_answer;
                        return (
                          <div key={optionIndex} className={`p-2 rounded ${isCorrectOption ? 'bg-green-100 text-green-800 border border-green-300' : isUserSelected ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-gray-50'}`}>
                            {String.fromCharCode(65 + optionIndex)}) {option}
                            {isCorrectOption && <span className="float-right">✓</span>}
                            {isUserSelected && !isCorrectOption && <span className="float-right">✗</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {question.type === 'open_ended' && (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Your answer: </span>
                        <span className={result.is_correct ? 'text-green-600' : 'text-red-600'}>
                          {result.user_answer || '(No answer provided)'}
                        </span>
                      </div>
                      {!result.is_correct && (
                        <div>
                          <span className="font-medium">Correct answer: </span>
                          <span className="text-green-600">{result.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {question.type === 'cloze' && (
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-gray-50 border rounded-lg">
                        <p className="text-gray-800 leading-relaxed">
                          {(question as any).originalText}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium">Your answer: </span>
                        <span className={result.is_correct ? 'text-green-600' : 'text-red-600'}>
                          {result.user_answer || '(No answer provided)'}
                        </span>
                      </div>
                      {!result.is_correct && (
                        <div>
                          <span className="font-medium">Correct answer: </span>
                          <span className="text-green-600">{result.correct_answer}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Retake Test
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{title || 'Test'}</CardTitle>
          <CardDescription>Answer all questions and submit when finished.</CardDescription>
        </CardHeader>
      </Card>
      <form onSubmit={e => { e.preventDefault(); submitTest(); }}>
        <div className="space-y-8">
          {questions.map((question, idx) => (
            <Card key={question.id} className="">
              <CardHeader>
                <CardTitle className="text-lg">
                  {idx + 1}. {question.type === 'cloze' 
                    ? (question as any).clozeText?.replace(/\{\{c1::(.*?)\}\}/g, '_______________')
                    : question.text
                  }
                </CardTitle>
                {question.quizTitle && <CardDescription className="text-xs">From: {question.quizTitle}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-4">
                {question.type === 'multiple_choice' && question.options && (
                  <RadioGroup
                    value={userAnswers[question.id] || ''}
                    onValueChange={value => handleAnswerChange(question.id, value)}
                  >
                    {question.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`option-${question.id}-${index}`} />
                        <Label htmlFor={`option-${question.id}-${index}`} className="cursor-pointer flex-1">
                          {String.fromCharCode(65 + index)}) {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
                {question.type === 'open_ended' && (
                  <Textarea
                    placeholder="Enter your answer here..."
                    value={userAnswers[question.id] || ''}
                    onChange={e => handleAnswerChange(question.id, e.target.value)}
                    rows={3}
                  />
                )}

                {question.type === 'cloze' && (
                  <div>
                    <Label htmlFor={`cloze-answer-${question.id}`} className="text-sm font-medium text-gray-700 mb-2 block">
                      Fill in the blank:
                    </Label>
                    <Input
                      id={`cloze-answer-${question.id}`}
                      placeholder="Enter your answer..."
                      value={userAnswers[question.id] || ''}
                      onChange={e => handleAnswerChange(question.id, e.target.value)}
                      className="text-lg"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex justify-between mt-8">
          <Button variant="outline" type="button" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Test'}
          </Button>
        </div>
      </form>
    </div>
  );
} 