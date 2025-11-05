import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '@/lib/api-client'

interface FormQuestion {
  id: string
  question_text: string
  field_type: string
  is_required: boolean
  validation_rules?: any
  answer_options?: any
}

interface FormGroup {
  id: string
  name: string
  description?: string
  sort_order: number
  questions: FormQuestion[]
}

interface FormTemplate {
  id: string
  name: string
  description?: string
  groups: FormGroup[]
}

export function useCompletionForm(templateId: string, jobId: string) {
  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load template and existing form data
  useEffect(() => {
    loadTemplate()
    loadFormData()
  }, [templateId, jobId])

  const loadTemplate = async () => {
    try {
      setIsLoading(true)
      const response = await apiClient.getCompletionFormTemplate(templateId)
      setTemplate(response)
    } catch (error) {
      console.error('Failed to load template:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadFormData = async () => {
    try {
      const response = await apiClient.getJobCompletionForm(jobId)
      if (response.form && response.form.form_data) {
        setFormData(response.form.form_data)
      }
    } catch (error) {
      console.error('Failed to load form data:', error)
    }
  }

  const updateField = useCallback((questionId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [questionId]: value,
    }))

    // Clear error when field is updated (only if error was previously set)
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }, [errors])

  const validateForm = useCallback(() => {
    if (!template) return {}

    const newErrors: Record<string, string> = {}

    template.groups.forEach((group) => {
      group.questions.forEach((question) => {
        if (question.is_required) {
          const value = formData[question.id]
          if (
            value === undefined ||
            value === null ||
            value === '' ||
            (Array.isArray(value) && value.length === 0)
          ) {
            newErrors[question.id] = 'This field is required'
          }
        }

        // Additional validation based on field type
        const value = formData[question.id]
        if (value) {
          switch (question.field_type) {
            case 'email':
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                newErrors[question.id] = 'Invalid email address'
              }
              break
            case 'phone':
              if (!/^\+?[\d\s-()]+$/.test(value)) {
                newErrors[question.id] = 'Invalid phone number'
              }
              break
            case 'number':
              if (isNaN(Number(value))) {
                newErrors[question.id] = 'Must be a number'
              }
              break
          }
        }
      })
    })

    setErrors(newErrors)
    return newErrors
  }, [template, formData])

  const saveForm = async () => {
    try {
      setIsSaving(true)
      await apiClient.saveJobCompletionForm(jobId, {
        template_id: templateId,
        form_data: formData,
        status: 'draft',
      })
    } catch (error) {
      console.error('Failed to save form:', error)
      throw error
    } finally {
      setIsSaving(false)
    }
  }

  const submitForm = async () => {
    try {
      setIsSubmitting(true)

      // First save the form
      await apiClient.saveJobCompletionForm(jobId, {
        template_id: templateId,
        form_data: formData,
        status: 'draft',
      })

      // Then submit it
      await apiClient.submitJobCompletionForm(jobId)
    } catch (error) {
      console.error('Failed to submit form:', error)
      throw error
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    template,
    formData,
    errors,
    isLoading,
    isSaving,
    isSubmitting,
    updateField,
    validateForm,
    saveForm,
    submitForm,
  }
}
