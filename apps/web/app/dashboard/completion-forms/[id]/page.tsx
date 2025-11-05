'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ArrowLeft, FileText, FolderOpen, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface Question {
  id: string
  question_text: string
  field_type: string
  is_required: boolean
  question_order: number
  answer_options: Array<{ id: string; text: string; value: string; option_order: number }> | null
  validation_rules: any
  help_text: string | null
}

interface Group {
  id: string
  group_name: string
  group_description: string | null
  group_order: number
  questions: Question[]
}

interface Template {
  id: string
  name: string
  description: string | null
  is_global: boolean
  is_active: boolean
  groups: Group[]
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Text Input',
  textarea: 'Long Text',
  number: 'Number',
  email: 'Email',
  phone: 'Phone',
  date: 'Date',
  datepicker: 'Date Picker',
  checkbox: 'Checkbox',
  radio: 'Radio Buttons',
  dropdown: 'Dropdown',
  multi_checkbox: 'Multiple Choice',
  checkboxlist: 'Checklist',
  file: 'File Upload',
}

export default function TemplateDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (params.id) {
      fetchTemplate(params.id as string)
    }
  }, [params.id])

  const fetchTemplate = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/completion-forms/templates/${id}`)
      if (!response.ok) throw new Error('Failed to fetch template')
      const data = await response.json()
      setTemplate(data)
    } catch (err: any) {
      console.error('Failed to fetch template:', err)
      setError(err.message || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-red-600">{error || 'Template not found'}</p>
        <Button onClick={() => router.push('/dashboard/completion-forms')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Templates
        </Button>
      </div>
    )
  }

  // Find questions with missing answer options
  const questionsNeedingAnswers = template.groups.flatMap(group =>
    group.questions.filter(q =>
      ['radio', 'dropdown', 'multi_checkbox', 'checkboxlist'].includes(q.field_type) &&
      (!q.answer_options || q.answer_options.length === 0)
    )
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/completion-forms')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{template.name}</h1>
            {template.is_global && <Badge variant="secondary">Global</Badge>}
            {template.is_active ? (
              <Badge variant="default">Active</Badge>
            ) : (
              <Badge variant="outline">Inactive</Badge>
            )}
          </div>
          {template.description && (
            <p className="text-muted-foreground mt-2">{template.description}</p>
          )}
        </div>
      </div>

      {/* Warning if questions need answers */}
      {questionsNeedingAnswers.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Warning:</strong> {questionsNeedingAnswers.length} question(s) are missing answer options.
            These questions will not work properly in the mobile app until answer options are added.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sections</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{template.groups.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {template.groups.reduce((sum, g) => sum + g.questions.length, 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Required Questions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {template.groups.reduce((sum, g) => sum + g.questions.filter(q => q.is_required).length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Groups and Questions */}
      <div className="space-y-6">
        {template.groups.map((group, groupIndex) => (
          <Card key={group.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-muted-foreground font-normal">Section {group.group_order}:</span>
                    {group.group_name}
                  </CardTitle>
                  {group.group_description && (
                    <CardDescription className="mt-2">
                      {group.group_description}
                    </CardDescription>
                  )}
                </div>
                <Badge variant="outline">{group.questions.length} questions</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {group.questions.map((question, questionIndex) => {
                  const needsAnswers = ['radio', 'dropdown', 'multi_checkbox', 'checkboxlist'].includes(question.field_type) &&
                    (!question.answer_options || question.answer_options.length === 0)

                  return (
                    <div
                      key={question.id}
                      className={`border rounded-lg p-4 ${needsAnswers ? 'border-red-300 bg-red-50' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-muted-foreground">Q{question.question_order}</span>
                            <Badge variant="secondary">{FIELD_TYPE_LABELS[question.field_type] || question.field_type}</Badge>
                            {question.is_required && (
                              <Badge variant="destructive" className="text-xs">Required</Badge>
                            )}
                            {needsAnswers && (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Missing Answers
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium">{question.question_text}</p>
                          {question.help_text && (
                            <p className="text-sm text-muted-foreground mt-1">{question.help_text}</p>
                          )}
                        </div>
                      </div>

                      {/* Answer Options */}
                      {question.answer_options && question.answer_options.length > 0 && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <p className="text-sm font-medium mb-2">Answer Options:</p>
                          <ul className="space-y-1">
                            {question.answer_options.map((option, idx) => (
                              <li key={option.id} className="text-sm flex items-center gap-2">
                                <span className="text-muted-foreground">{idx + 1}.</span>
                                <span>{option.text}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Warning for missing answer options */}
                      {needsAnswers && (
                        <Alert variant="destructive" className="mt-3">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            This {FIELD_TYPE_LABELS[question.field_type] || question.field_type} question requires answer options to function properly.
                            Please add answer options in the database or contact support.
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Validation Rules */}
                      {question.validation_rules && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          Validation: {JSON.stringify(question.validation_rules)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
