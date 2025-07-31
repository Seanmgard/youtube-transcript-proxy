'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSupabase } from '@/utils/supabase/client';
import QuizUploader from '@/app/components/QuizUploader';
import QuizHistory from '@/components/QuizHistory';
import SummaryRenderer from '@/app/components/SummaryRenderer';
import { Loader2, FileDown, FileText, Send, Download, Check, Upload, Eye, Clock, Edit, ZoomIn, Copy, X, CheckCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import Link from 'next/link';
import { useToast } from '@/app/components/ui/use-toast';
import { useSubscription } from '@/hooks/useSubscription';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { generateQuiz } from '@/utils/api-client';
import { QuizSettings, Question } from '@/lib/types';
import { AnkiExportDialog } from '@/app/components/AnkiExportDialog';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import ClozeEditor from '@/app/components/ClozeEditor';
import { QuestionEditor } from '@/app/components/QuestionEditor';
import { ImageZoomModal } from '@/app/components/ImageZoomModal';

export default function Dashboard() {
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [currentSummary, setCurrentSummary] = useState<string>('');
  const [streamingText, setStreamingText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [quizRestored, setQuizRestored] = useState<boolean>(false);
  const [questionsGenerated, setQuestionsGenerated] = useState(0);
  const [totalQuestionsTarget, setTotalQuestionsTarget] = useState(0);
  const [generationPhase, setGenerationPhase] = useState<'preparing' | 'generating' | 'completing' | 'completed'>('preparing');
  const [activeTab, setActiveTab] = useState<'quiz' | 'summary'>('quiz');
  const [summaryEnabled, setSummaryEnabled] = useState<boolean>(true); // Track if summary generation is enabled
  const [copyButtonState, setCopyButtonState] = useState<'idle' | 'copying' | 'copied'>('idle');
  const { user } = useAuth();

  // Switch to quiz tab if summary is disabled while on summary tab
  useEffect(() => {
    if (!summaryEnabled && activeTab === 'summary') {
      setActiveTab('quiz');
    }
  }, [summaryEnabled, activeTab]);

  // Reset copy button state when switching tabs or content changes
  useEffect(() => {
    setCopyButtonState('idle');
  }, [activeTab, currentQuiz, currentSummary]);

  // Handle page visibility changes to ensure proper state management
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && currentSummary) {
        // Page became visible and we have a summary - ensure streaming states are cleared
        setIsStreaming(false);
        setStreamingText('');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [currentSummary]);
  const { supabase, loading: supabaseLoading } = useSupabase();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'doc' | 'csv' | 'anki' | 'success' | null>(null);
  const [isAnkiDialogOpen, setIsAnkiDialogOpen] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [isQuestionEditorOpen, setIsQuestionEditorOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<{ url: string; alt: string; title: string } | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const resultsRef = useRef<HTMLDivElement>(null);
  const { isOnPlan } = useSubscription();

  // Load quiz and summary from localStorage on component mount
  useEffect(() => {
    const savedQuiz = localStorage.getItem('currentQuiz');
    const savedSummary = localStorage.getItem('currentSummary');
    
    if (savedQuiz) {
      try {
        const quizData = JSON.parse(savedQuiz);
        setCurrentQuiz(quizData);
        setQuizRestored(true);
      } catch (error) {
        console.error('Error parsing saved quiz:', error);
        localStorage.removeItem('currentQuiz');
      }
    }
    
    if (savedSummary) {
      setCurrentSummary(savedSummary);
      // Reset streaming states when loading persisted summary
      setIsStreaming(false);
      setStreamingText('');
    }
    
    setLoading(false);
  }, []);

  // Save quiz to localStorage whenever currentQuiz changes
  useEffect(() => {
    if (currentQuiz && currentQuiz.title !== 'Error') {
      localStorage.setItem('currentQuiz', JSON.stringify(currentQuiz));
    }
  }, [currentQuiz]);

  // Save summary to localStorage whenever currentSummary changes
  useEffect(() => {
    if (currentSummary) {
      localStorage.setItem('currentSummary', currentSummary);
    }
  }, [currentSummary]);

  const handleQuizGenerated = (quiz: any) => {
      setCurrentQuiz(quiz);
      setQuizRestored(false);
    // Switch to quiz tab when quiz is generated
    setActiveTab('quiz');
  };

  const handleSummaryGenerated = (summary: string) => {
    setCurrentSummary(summary);
    // Reset streaming states when summary generation completes
    setIsStreaming(false);
    setStreamingText('');
    // Switch to summary tab when summary is generated
    setActiveTab('summary');
  };

  const handleStreamingUpdate = (text: string) => {
    setStreamingText(text);
      setIsStreaming(true);
  };

  const handleGenerationStart = () => {
    // Scroll to the results section with smooth scrolling
    setTimeout(() => {
      if (resultsRef.current) {
        const headerHeight = 80; // Account for any sticky headers
        const elementTop = resultsRef.current.offsetTop - headerHeight;
        window.scrollTo({
          top: elementTop,
          behavior: 'smooth'
        });
      }
    }, 100); // Small delay to ensure DOM updates
  };

  const copyToClipboard = async (content: string, type: 'quiz' | 'summary') => {
    try {
      setCopyButtonState('copying');
      
      // Format the content for better readability when copied
      let formattedContent = content;
      if (type === 'summary') {
        // Clean up markdown formatting for better plain text readability
        formattedContent = content
          .replace(/^#+\s*/gm, '') // Remove markdown headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
          .replace(/\n{3,}/g, '\n\n') // Reduce excessive line breaks
          .trim();
      }
      
      await navigator.clipboard.writeText(formattedContent);
      setCopyButtonState('copied');
      
      toast({
        title: "Copied!",
        description: `${type === 'quiz' ? 'Quiz' : 'Study guide'} copied to clipboard`,
      });
      
      // Reset button state after animation
      setTimeout(() => setCopyButtonState('idle'), 2000);
    } catch (error) {
      setCopyButtonState('idle');
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const clearContent = () => {
    if (activeTab === 'quiz') {
      setCurrentQuiz(null);
      localStorage.removeItem('currentQuiz');
      toast({
        title: "Cleared",
        description: "Quiz content has been cleared",
      });
    } else if (activeTab === 'summary') {
      setCurrentSummary('');
      localStorage.removeItem('currentSummary');
      toast({
        title: "Cleared", 
        description: "Study guide has been cleared",
      });
    }
  };

  const downloadSummary = async () => {
    try {
      // Convert markdown to Word document paragraphs
      const lines = currentSummary.split('\n');
      const children: (Paragraph)[] = [];

      for (const line of lines) {
        if (line.trim() === '') {
          children.push(new Paragraph({ children: [new TextRun('')] }));
        } else if (line.startsWith('# ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.substring(2), bold: true, size: 32 })],
            heading: HeadingLevel.HEADING_1
          }));
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.substring(3), bold: true, size: 28 })],
            heading: HeadingLevel.HEADING_2
          }));
        } else if (line.startsWith('### ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.substring(4), bold: true, size: 24 })],
            heading: HeadingLevel.HEADING_3
          }));
        } else if (line.startsWith('**') && line.endsWith('**')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line.slice(2, -2), bold: true })]
          }));
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(new Paragraph({
            children: [new TextRun({ text: '• ' + line.substring(2) })],
            indent: { left: 400 }
          }));
        } else {
          // Handle bold text within paragraphs
          const parts = line.split(/(\*\*.*?\*\*)/);
          const textRuns = parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return new TextRun({ text: part.slice(2, -2), bold: true });
            } else {
              return new TextRun({ text: part });
            }
          });
          
          children.push(new Paragraph({ children: textRuns }));
        }
      }

      const doc = new Document({
        sections: [{
          properties: {},
          children: children
        }]
      });

      const buffer = await Packer.toBlob(doc);
      const url = URL.createObjectURL(buffer);
      const a = document.createElement('a');
      a.href = url;
      a.download = `summary_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Downloaded!",
        description: "Summary downloaded as Word document",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Unable to download summary",
        variant: "destructive",
      });
    }
  };

  // Export functions and other handlers remain the same...
  const handleExport = async (format: 'doc' | 'csv') => {
    if (!currentQuiz || currentQuiz.loading || currentQuiz.title === 'Error') return;
    
    setExporting(format);
    
    try {
      const response = await fetch('/api/export-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quiz: currentQuiz,
          format: format,
        }),
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const fileName = `${currentQuiz.title || 'quiz'}.${format === 'doc' ? 'docx' : 'csv'}`;
      a.download = fileName;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExporting('success');
      
      toast({
        title: "Export Successful",
        description: `Quiz exported as ${format.toUpperCase()} file`,
      });

      setTimeout(() => {
        setExporting(null);
      }, 2000);

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "There was an error exporting your quiz. Please try again.",
        variant: "destructive",
      });
      setExporting(null);
    }
  };

  const handleSendToAnki = () => {
    if (!currentQuiz || currentQuiz.loading || currentQuiz.title === 'Error') return;
    
    setSelectedQuizId(currentQuiz.id || 'current-quiz');
    setIsAnkiDialogOpen(true);
  };

  const closeAnkiDialog = () => {
    setIsAnkiDialogOpen(false);
    setSelectedQuizId(null);
  };

  const openQuestionEditor = (questionIndex: number) => {
    setEditingQuestionIndex(questionIndex);
    setIsQuestionEditorOpen(true);
  };

  const closeQuestionEditor = () => {
    setEditingQuestionIndex(null);
    setIsQuestionEditorOpen(false);
  };

  const handleQuestionSave = (updatedQuestion: Question) => {
    if (editingQuestionIndex !== null && currentQuiz) {
      const updatedQuestions = [...currentQuiz.questions];
      updatedQuestions[editingQuestionIndex] = updatedQuestion;
      const updatedQuiz = { ...currentQuiz, questions: updatedQuestions };
      setCurrentQuiz(updatedQuiz);
      toast({
        title: "Question Updated",
        description: "The question has been successfully updated.",
      });
    }
    closeQuestionEditor();
  };

  // Function to render the quiz content
  const renderQuizContent = () => {
    if (!currentQuiz) {
      return (
        <div className="text-gray-500 text-center h-full flex flex-col justify-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="mb-2 text-lg">Your quiz will appear here</p>
          <p className="text-sm">Upload a document above to generate your quiz</p>
        </div>
      );
    }

    if (currentQuiz.loading) {
      return (
        <div className="space-y-4">
          <div className="flex items-center mb-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              {generationPhase === 'preparing' && 'Preparing your quiz...'}
              {generationPhase === 'generating' && `Generating questions... (${questionsGenerated}/${totalQuestionsTarget})`}
              {generationPhase === 'completing' && 'Finalizing your quiz...'}
            </span>
          </div>
          
          {streamingText && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                <div className="text-sm font-medium text-blue-900">
                  {streamingText}
                </div>
              </div>
              <div className="text-xs text-gray-500 italic">
                Please wait while we generate your quiz. This may take a few moments.
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentQuiz.title === 'Error') {
      return (
        <div className="text-red-500 text-center">
          <p className="mb-2">There was an error generating your quiz</p>
          <p className="text-sm">Please try uploading your document again</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
            {quizRestored && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center">
              <Check className="h-4 w-4 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-800">
                Quiz restored from your last session
              </span>
            </div>
          </div>
        )}

        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{currentQuiz.title}</h3>
          <div className="flex flex-wrap gap-2 text-sm text-gray-600">
            <span className="bg-blue-100 px-2 py-1 rounded">
              {currentQuiz.questions?.length || 0} questions
            </span>
            <span className="bg-green-100 px-2 py-1 rounded">
              {currentQuiz.difficulty || 'medium'} difficulty
            </span>
            <span className="bg-purple-100 px-2 py-1 rounded">
              {currentQuiz.type || 'multiple_choice'} format
            </span>
          </div>
        </div>
        
        <div className="space-y-3">
          {currentQuiz.questions?.map((question: any, index: number) => (
            <div key={index} className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-semibold rounded-md shadow-sm">
                    {index + 1}
                  </div>
                  <h4 className="font-semibold text-gray-800 text-sm">
                    {question.type === 'multiple_choice' ? 'Multiple Choice' : 
                     question.type === 'cloze' ? 'Cloze Deletion' : 'Open Ended'}
                  </h4>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openQuestionEditor(index)}
                  className="text-gray-500 hover:text-gray-700 hover:bg-white/70 rounded-lg transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
              
              {question.frontImage && (
                <div className="mb-3">
                  <div className="relative group cursor-pointer inline-block">
                      <img
                        src={question.frontImage.url}
                        alt={question.frontImage.alt || 'Question image'}
                        className={`rounded object-contain transition-all duration-200 ${
                          question.frontImage.size === 'small' ? 'max-h-20' :
                          question.frontImage.size === 'large' ? 'max-h-40' :
                          'max-h-32'
                        }`}
                        onClick={() => setZoomedImage({
                          url: question.frontImage.url,
                          alt: question.frontImage.alt || 'Question image',
                          title: 'Question Image'
                        })}
                      />
                      <div className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ZoomIn className="h-3 w-3 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Question Image</p>
                    </div>
                </div>
              )}
              
              <div className="mb-3">
                <div className="bg-white/60 rounded-lg p-3 border border-gray-100 mb-3">
                  <p className="text-sm font-medium text-gray-900 leading-relaxed">
                    {question.type === 'cloze' && question.clozeText 
                      ? question.clozeText.replace(/\{\{c1::(.*?)\}\}/g, '_______________')
                      : question.text
                    }
                  </p>
                </div>
              
              {question.type === 'multiple_choice' && question.options && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-gray-700 mb-1">Answer Options:</p>
                    {question.options.map((option: string, optionIndex: number) => (
                      <div key={optionIndex} className="flex items-start space-x-2 p-2 bg-white/40 rounded-md border border-gray-100 hover:bg-white/60 transition-colors">
                        <div className="flex items-center justify-center w-5 h-5 bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 text-xs font-semibold rounded-full flex-shrink-0 mt-0.5">
                          {String.fromCharCode(65 + optionIndex)}
                        </div>
                        <span className="text-xs text-gray-800 leading-relaxed">{option}</span>
                      </div>
                    ))}
                  </div>
              )}

                {question.type === 'cloze' && (
                  <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-yellow-50 p-2 rounded-md border border-amber-200">
                    <span className="text-xs text-amber-700 font-medium">Fill-in-the-blank question</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openQuestionEditor(index)}
                      className="text-xs text-amber-700 hover:text-amber-900 border-amber-300 hover:bg-amber-100 rounded px-3 py-1"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Question
                    </Button>
                  </div>
                )}
                    </div>

              {question.backImage && (
                <div className="mb-3">
                  <div className="relative group cursor-pointer inline-block">
                      <img
                        src={question.backImage.url}
                        alt={question.backImage.alt || 'Answer image'}
                        className={`rounded object-contain transition-all duration-200 ${
                          question.backImage.size === 'small' ? 'max-h-20' :
                          question.backImage.size === 'large' ? 'max-h-40' :
                          'max-h-32'
                        }`}
                        onClick={() => setZoomedImage({
                          url: question.backImage.url,
                          alt: question.backImage.alt || 'Answer image',
                          title: 'Answer Image'
                        })}
                      />
                      <div className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <ZoomIn className="h-3 w-3 text-gray-600" />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Answer Image</p>
                    </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-semibold text-gray-700">Correct Answer</span>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-md p-2">
                  {question.type === 'multiple_choice' && question.options ? (
                    (() => {
                      let correctIndex = -1;
                      let correctText = question.correctAnswer;
                      
                      correctIndex = question.options.findIndex((option: string) => 
                        option.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase()
                      );
                      
                      if (correctIndex === -1) {
                        const answerLetter = question.correctAnswer.trim().toUpperCase();
                        if (answerLetter.match(/^[A-D]$/)) {
                          correctIndex = answerLetter.charCodeAt(0) - 65;
                          if (correctIndex >= 0 && correctIndex < question.options.length) {
                            correctText = question.options[correctIndex];
                          }
                        }
                      }
                      
                      if (correctIndex === -1) {
                        const letterMatch = question.correctAnswer.match(/^([A-D])\)\s*(.+)$/i);
                        if (letterMatch) {
                          correctIndex = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
                          correctText = letterMatch[2];
                        }
                      }
                      
                      const answerLetter = correctIndex !== -1 ? String.fromCharCode(65 + correctIndex) : '';
                      
                                              return (
                          <div className="flex items-center space-x-2">
                            {answerLetter && (
                              <div className="flex items-center justify-center w-5 h-5 bg-green-600 text-white text-xs font-semibold rounded-full">
                                {answerLetter}
                              </div>
                            )}
                            <span className="text-xs font-medium text-green-800">{correctText}</span>
                          </div>
                        );
                    })()
                                      ) : (
                      <span className="text-xs font-medium text-green-800">{question.correctAnswer}</span>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Function to render the summary content
  const renderSummaryContent = () => {
    if (!currentSummary && !isStreaming) {
  return (
        <div className="text-gray-500 text-center h-full flex flex-col justify-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="mb-2 text-lg">Your study guide will appear here</p>
          <p className="text-sm">Generate a summary to create a detailed document study guide</p>
        </div>
      );
    }

    if (isStreaming && !currentSummary) {
      return (
        <div className="space-y-4">
          <div className="flex items-center mb-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">
              Generating comprehensive study guide...
            </span>
          </div>
          
          {streamingText && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg border bg-blue-50 border-blue-200">
                <div className="text-sm font-medium text-blue-900">
                  {streamingText}
                </div>
              </div>
              <div className="text-xs text-gray-500 italic">
                Please wait while we analyze your document and generate a comprehensive summary.
              </div>
            </div>
          )}
        </div>
      );
    }

    return <SummaryRenderer content={currentSummary} />;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {!user || loading || supabaseLoading ? (
        <div className="flex justify-center items-center h-[70vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <>
          {/* Streamlined Header Section */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
                <p className="text-gray-600 text-sm">
                  Upload your materials to generate quiz questions and comprehensive study guides.
                </p>
              </div>
              <div className="hidden md:block">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Upload Section */}
            <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 sm:px-6 py-4 border-b border-green-100">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
                  <Upload className="w-5 h-5 mr-2 text-green-600" />
                Create Quiz & Study Guide
                </h2>
              </div>
              <div className="p-4 sm:p-6">
                <QuizUploader 
                  onQuizGenerated={handleQuizGenerated}
                onSummaryGenerated={handleSummaryGenerated}
                  onStreamingUpdate={handleStreamingUpdate}
                  onSettingsChange={(settings) => setSummaryEnabled(settings.summary?.enabled || false)}
                  onGenerationStart={handleGenerationStart}
                />
              </div>
            </div>

          {/* Content Display Section */}
            <div ref={resultsRef} className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 sm:px-6 py-4 border-b border-blue-100">
              <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                    <Eye className="w-5 h-5 mr-2 text-blue-600" />
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Your Quiz & Study Guide</h2>
                      </div>
                    
                {/* Action Buttons */}
                <div className="flex items-center space-x-2">
                  {activeTab === 'summary' && currentSummary && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(currentSummary, 'summary')}
                        className={`text-xs transition-all duration-200 ${
                          copyButtonState === 'copied' 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : copyButtonState === 'copying' 
                            ? 'bg-blue-50 border-blue-200' 
                            : ''
                        }`}
                        disabled={copyButtonState === 'copying'}
                      >
                        {copyButtonState === 'copied' ? (
                          <>
                            <CheckCheck className="w-3 h-3 mr-1" />
                            Copied!
                          </>
                        ) : copyButtonState === 'copying' ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Copying...
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 mr-1" />
                            Copy
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={downloadSummary}
                        className="text-xs"
                      >
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearContent}
                        className="text-xs text-red-600 hover:bg-red-50 hover:border-red-200"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    </>
                  )}
                  
                  {activeTab === 'quiz' && currentQuiz && !currentQuiz.loading && currentQuiz.title !== 'Error' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={exporting !== null && exporting !== 'success'}
                          className="bg-white hover:bg-blue-50 text-xs"
                            >
                              {exporting === 'success' ? (
                                <>
                              <Check className="w-3 h-3 mr-1 text-green-600" />
                              Exported
                                </>
                              ) : exporting ? (
                                <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Exporting...
                                </>
                              ) : (
                                <>
                              <FileDown className="w-3 h-3 mr-1" />
                              Export
                                </>
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem 
                              onClick={() => handleExport('doc')}
                              disabled={exporting !== null && exporting !== 'success'}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Word Document
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleExport('csv')}
                              disabled={exporting !== null && exporting !== 'success'}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          CSV Spreadsheet
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={handleSendToAnki}
                              disabled={exporting !== null && exporting !== 'success'}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Anki Export
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    
                    {/* Clear Button for Quiz */}
                    {activeTab === 'quiz' && currentQuiz && !currentQuiz.loading && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearContent}
                        className="text-xs text-red-600 hover:bg-red-50 hover:border-red-200"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'quiz' | 'summary')} className="w-full">
              <TabsList className="w-full border-b rounded-none bg-transparent">
                <TabsTrigger 
                  value="quiz" 
                  className="flex-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Quiz Questions
                  {currentQuiz && currentQuiz.questions && (
                    <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                      {currentQuiz.questions.length}
                    </span>
                  )}
                </TabsTrigger>
                {summaryEnabled && (
                  <TabsTrigger 
                    value="summary" 
                    className="flex-1 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-b-2 data-[state=active]:border-blue-500"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Study Guide
                    {currentSummary && (
                      <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                        Ready
                      </span>
                    )}
                  </TabsTrigger>
                )}
              </TabsList>
              
              <TabsContent value="quiz" className="p-6 min-h-[600px]">
                {renderQuizContent()}
              </TabsContent>
              
              {summaryEnabled && (
                <TabsContent value="summary" className="p-6 min-h-[600px]">
                  {renderSummaryContent()}
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Recent Quizzes Section */}
          <div className="bg-white rounded-lg shadow-md border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-purple-100">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-purple-600" />
                  Recent Quizzes
                </h2>
                <Link href="/dashboard/history">
                  <Button variant="outline" className="hover:bg-purple-50">View All</Button>
                </Link>
              </div>
            </div>
            <div className="p-6">
              <QuizHistory limit={5} />
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      {selectedQuizId && (
        <AnkiExportDialog
          isOpen={isAnkiDialogOpen}
          onClose={closeAnkiDialog}
          quizId={selectedQuizId}
        />
      )}

      {editingQuestionIndex !== null && currentQuiz?.questions[editingQuestionIndex] && (
        <QuestionEditor
          question={currentQuiz.questions[editingQuestionIndex]}
          isOpen={isQuestionEditorOpen}
          onClose={closeQuestionEditor}
          onSave={handleQuestionSave}
        />
      )}

      {zoomedImage && (
        <ImageZoomModal
          isOpen={!!zoomedImage}
          onClose={() => setZoomedImage(null)}
          imageUrl={zoomedImage.url}
          imageAlt={zoomedImage.alt}
          imageTitle={zoomedImage.title}
        />
      )}
    </div>
  );
} 