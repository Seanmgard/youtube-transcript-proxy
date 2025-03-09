'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import { Plus, X, Check } from 'lucide-react'
import { useToast } from '@/app/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/app/components/ui/dialog'

// Predefined color options
export const SUBJECT_COLORS = [
  { name: 'Red', value: '#FFEBEE', textColor: '#C62828' },
  { name: 'Pink', value: '#FCE4EC', textColor: '#AD1457' },
  { name: 'Purple', value: '#F3E5F5', textColor: '#6A1B9A' },
  { name: 'Deep Purple', value: '#EDE7F6', textColor: '#4527A0' },
  { name: 'Indigo', value: '#E8EAF6', textColor: '#283593' },
  { name: 'Blue', value: '#E3F2FD', textColor: '#1565C0' },
  { name: 'Light Blue', value: '#E1F5FE', textColor: '#0277BD' },
  { name: 'Cyan', value: '#E0F7FA', textColor: '#00838F' },
  { name: 'Teal', value: '#E0F2F1', textColor: '#00695C' },
  { name: 'Green', value: '#E8F5E9', textColor: '#2E7D32' },
  { name: 'Light Green', value: '#F1F8E9', textColor: '#558B2F' },
  { name: 'Lime', value: '#F9FBE7', textColor: '#9E9D24' },
  { name: 'Yellow', value: '#FFFDE7', textColor: '#F9A825' },
  { name: 'Amber', value: '#FFF8E1', textColor: '#FF8F00' },
  { name: 'Orange', value: '#FFF3E0', textColor: '#EF6C00' },
  { name: 'Deep Orange', value: '#FBE9E7', textColor: '#D84315' },
  { name: 'Brown', value: '#EFEBE9', textColor: '#4E342E' },
  { name: 'Grey', value: '#FAFAFA', textColor: '#424242' },
  { name: 'Blue Grey', value: '#ECEFF1', textColor: '#37474F' },
]

export interface Subject {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

interface SubjectManagerProps {
  onSelectSubject?: (subject: Subject | null) => void;
  selectedSubjectId?: string | null;
}

export default function SubjectManager({ onSelectSubject, selectedSubjectId }: SubjectManagerProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [selectedColor, setSelectedColor] = useState(SUBJECT_COLORS[0].value)
  const { toast } = useToast()
  const [supabase, setSupabase] = useState<any>(null)

  useEffect(() => {
    const initSupabase = async () => {
      const client = await createClient();
      setSupabase(client);
    };
    
    initSupabase();
  }, []);

  useEffect(() => {
    if (supabase) {
      fetchSubjects();
    }
  }, [supabase]);

  const fetchSubjects = async () => {
    if (!supabase) return;
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('Authentication error:', userError)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('subjects')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) {
        throw error
      }
      
      setSubjects(data || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
      toast({
        title: 'Error',
        description: 'Failed to load subjects',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const createSubject = async () => {
    if (!supabase) return;
    
    try {
      if (!newSubjectName.trim()) {
        toast({
          title: 'Error',
          description: 'Subject name cannot be empty',
          variant: 'destructive',
        })
        return
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        toast({
          title: 'Error',
          description: 'Authentication error',
          variant: 'destructive',
        })
        return
      }

      const { data, error } = await supabase
        .from('subjects')
        .insert({
          name: newSubjectName.trim(),
          color: selectedColor,
          user_id: user.id,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      setSubjects([...subjects, data])
      setNewSubjectName('')
      setSelectedColor(SUBJECT_COLORS[0].value)
      setIsDialogOpen(false)
      
      // Automatically select the newly created subject
      if (onSelectSubject) {
        onSelectSubject(data)
      }
      
      toast({
        title: 'Success',
        description: 'Subject created successfully',
      })
    } catch (error) {
      console.error('Error creating subject:', error)
      toast({
        title: 'Error',
        description: 'Failed to create subject',
        variant: 'destructive',
      })
    }
  }

  const deleteSubject = async (id: string) => {
    if (!supabase) return;
    
    try {
      const { error } = await supabase
        .from('subjects')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      setSubjects(subjects.filter(subject => subject.id !== id))
      
      // If the deleted subject was selected, deselect it
      if (selectedSubjectId === id && onSelectSubject) {
        onSelectSubject(null)
      }
      
      toast({
        title: 'Success',
        description: 'Subject deleted successfully',
      })
    } catch (error) {
      console.error('Error deleting subject:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete subject',
        variant: 'destructive',
      })
    }
  }

  const handleSelectSubject = (subject: Subject | null) => {
    if (onSelectSubject) {
      onSelectSubject(subject)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Subjects</h3>
        <Button 
          size="sm" 
          onClick={() => setIsDialogOpen(true)}
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Subject
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <div className="space-y-2">
          <div 
            className={`flex justify-between items-center p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${!selectedSubjectId ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
            onClick={() => handleSelectSubject(null)}
          >
            <span>No Subject</span>
            {!selectedSubjectId && <Check className="h-4 w-4 text-primary" />}
          </div>
          
          {subjects.map(subject => (
            <div 
              key={subject.id} 
              className={`flex justify-between items-center p-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${selectedSubjectId === subject.id ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
              onClick={() => handleSelectSubject(subject)}
            >
              <div className="flex items-center">
                <div 
                  className="h-4 w-4 rounded-full mr-2" 
                  style={{ backgroundColor: subject.color }}
                ></div>
                <span>{subject.name}</span>
              </div>
              <div className="flex items-center">
                {selectedSubjectId === subject.id && <Check className="h-4 w-4 text-primary mr-2" />}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSubject(subject.id)
                  }}
                >
                  <X className="h-4 w-4 text-gray-500 hover:text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject-name">Subject Name</Label>
              <Input 
                id="subject-name" 
                value={newSubjectName} 
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="e.g., Mathematics, History, Science"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-6 gap-2">
                {SUBJECT_COLORS.map(color => (
                  <div 
                    key={color.value}
                    className={`h-8 w-8 rounded-full cursor-pointer flex items-center justify-center ${selectedColor === color.value ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setSelectedColor(color.value)}
                  >
                    {selectedColor === color.value && (
                      <Check className="h-4 w-4" style={{ color: color.textColor }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={createSubject}>Create Subject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 