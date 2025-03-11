'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Quiz } from '@/lib/types'

interface QuizHistoryProps {
  limit?: number;
}

export default function QuizHistory({ limit }: QuizHistoryProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    fetchQuizzes()
  }, [])

  const fetchQuizzes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('quizzes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (limit) {
        query = query.limit(limit)
      }

      const { data, error } = await query

      if (error) throw error
      console.log('Fetched quizzes in QuizHistory:', data)
      setQuizzes(data || [])
    } catch (error) {
      console.error('Error fetching quizzes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (quiz: Quiz, format: 'doc' | 'csv' | 'anki') => {
    try {
      const response = await fetch(`/api/export-quiz?id=${quiz.id}&format=${format}`, {
        method: 'GET',
      })

      if (!response.ok) throw new Error('Failed to export quiz')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `quiz-${quiz.id}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error exporting quiz:', error)
    }
  }

  if (loading) {
    return <div>Loading your quiz history...</div>
  }

  if (quizzes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No quizzes generated yet. Upload a PDF to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <div
          key={quiz.id}
          className="p-4 bg-gray-50 rounded-lg dark:bg-gray-700"
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{quiz.title}</h3>
              <p className="text-sm text-gray-500">
                Created: {new Date(quiz.created_at).toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-500">
                {quiz.questions.length} questions • {quiz.settings.difficulty} difficulty
              </p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(quiz, 'doc')}
              >
                Export DOC
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(quiz, 'csv')}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport(quiz, 'anki')}
              >
                Export Anki
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 