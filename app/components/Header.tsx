'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/app/components/ui/button'
import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function Header() {
  const router = useRouter()
  const [supabase, setSupabase] = useState<any>(null)
  
  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClientComponentClient()
      setSupabase(client)
    }
    
    initSupabase()
  }, [])

  const handleSignOut = async () => {
    if (!supabase) return
    
    await supabase.auth.signOut()
    router.refresh()
    router.push('/auth/sign-in')
  }

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-primary">
            QuizLab AI
          </Link>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
} 