import { useEffect, useState } from 'react'
import type { SeparationPayload } from '../types'

interface StatusChangeModalProps {
  open: boolean
  targetStatus: 'RESIGNED' | 'TERMINATED' | null
  onClose: () => void
  onConfirm: (payload: SeparationPayload) => Promise<void>
}

interface ClearancePaymentModalProps {
  open: boolean
  amount: number | null
  chequeNumber: string
  onCancel: () => void
  onSave: (amount: number, chequeNumber: string) => void
}

const ClearancePaymentModal = ({ open, amount, chequeNumber, onCancel, onSave }: ClearancePaymentModalProps) => {
  const [localAmount, setLocalAmount] = useState<string>(amount !== null ? String(amount) : '')
  const [localCheque, setLocalCheque] = useState<string>(chequeNumber)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLocalAmount(amount !== null ? String(amount) : '')
      setLocalCheque(chequeNumber)
      setError(null)
    }
  }, [open, amount, chequeNumber])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Clearance payment</h3>
        <p className="mt-1 text-sm text-slate-600">Enter clearance settlement details.</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700">Amount *</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={localAmount}
              onChange={(e) => setLocalAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Cheque number *</label>
            <input
              type="text"
              value={localCheque}
              onChange={(e) => setLocalCheque(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (localAmount === '' || Number.isNaN(Number(localAmount))) {
                  setError('Clearance amount is required.')
                  return
                }
                if (!localCheque.trim()) {
                  setError('Cheque number is required.')
                  return
                }
                onSave(Number(localAmount), localCheque.trim())
              }}
              className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white shadow-md transition hover:bg-primary-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const StatusChangeModal = ({ open, targetStatus, onClose, onConfirm }: StatusChangeModalProps) => {
  const [separationDate, setSeparationDate] = useState('')
  const [finalDay, setFinalDay] = useState('')
  const [reason, setReason] = useState('')
  const [eligible, setEligible] = useState<boolean | undefined>(undefined)
  const [noticeGiven, setNoticeGiven] = useState<boolean | undefined>(undefined)
  const [noticeDays, setNoticeDays] = useState<number | ''>('')
  const [exitInterview, setExitInterview] = useState(false)
  const [clearanceDone, setClearanceDone] = useState(false)
  const [clearanceAmount, setClearanceAmount] = useState<number | null>(null)
  const [clearanceChequeNumber, setClearanceChequeNumber] = useState('')
  const [clearanceModalOpen, setClearanceModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSeparationDate('')
      setFinalDay('')
      setReason('')
      setEligible(undefined)
      setNoticeGiven(undefined)
      setNoticeDays('')
      setExitInterview(false)
      setClearanceDone(false)
      setClearanceAmount(null)
      setClearanceChequeNumber('')
      setClearanceModalOpen(false)
      setError(null)
    }
  }, [open, targetStatus])

  if (!open || !targetStatus) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!separationDate) {
      setError('Separation date is required.')
      return
    }
    if (clearanceDone && (clearanceAmount === null || clearanceChequeNumber.trim() === '')) {
      setError('Clearance amount and cheque number are required when clearance is done.')
      return
    }
    setSubmitting(true)
    try {
      const payload: SeparationPayload = {
        separation_type: targetStatus,
        separation_date: separationDate,
        separation_reason: reason || undefined,
        final_working_day: finalDay || undefined,
        eligible_for_rehire: eligible,
        notice_given: noticeGiven,
        notice_days_served: noticeDays === '' ? null : Number(noticeDays),
        exit_interview_done: exitInterview,
        clearance_done: clearanceDone,
        clearance_amount: clearanceAmount,
        clearance_cheque_number: clearanceChequeNumber || null,
      }
      await onConfirm(payload)
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save status change.')
    } finally {
      setSubmitting(false)
    }
  }

  const badge = targetStatus === 'RESIGNED' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Status change</p>
            <h2 className="text-xl font-bold text-slate-900">
              Change status to{' '}
              <span className={`rounded-full px-2 py-1 text-sm ${badge}`}>
                {targetStatus === 'RESIGNED' ? 'Resigned' : 'Terminated'}
              </span>
            </h2>
            <p className="text-sm text-slate-600">Collect separation details before updating.</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Separation date *</label>
              <input
                type="date"
                value={separationDate}
                onChange={(e) => setSeparationDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Final working day</label>
              <input
                type="date"
                value={finalDay}
                onChange={(e) => setFinalDay(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Reason</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={eligible ?? false}
                onChange={(e) => setEligible(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label className="text-sm font-medium text-slate-700">Eligible for rehire</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={noticeGiven ?? false}
                onChange={(e) => setNoticeGiven(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label className="text-sm font-medium text-slate-700">Notice given</label>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Notice days served</label>
              <input
                type="number"
                min={0}
                value={noticeDays}
                onChange={(e) => setNoticeDays(e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={exitInterview}
                onChange={(e) => setExitInterview(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label className="text-sm font-medium text-slate-700">Exit interview done</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={clearanceDone}
                onChange={(e) => {
                  if (e.target.checked) {
                    setClearanceModalOpen(true)
                  } else {
                    setClearanceDone(false)
                    setClearanceAmount(null)
                    setClearanceChequeNumber('')
                  }
                }}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label className="text-sm font-medium text-slate-700">Clearance done</label>
            </div>
          </div>
          {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white shadow-md transition hover:bg-primary-700 disabled:opacity-70"
            >
              {submitting ? 'Saving...' : 'Save change'}
            </button>
          </div>
        </form>
      </div>
      <ClearancePaymentModal
        open={clearanceModalOpen}
        amount={clearanceAmount}
        chequeNumber={clearanceChequeNumber}
        onCancel={() => {
          setClearanceModalOpen(false)
          setClearanceDone(false)
          setClearanceAmount(null)
          setClearanceChequeNumber('')
        }}
        onSave={(amount, chequeNumber) => {
          setClearanceAmount(amount)
          setClearanceChequeNumber(chequeNumber)
          setClearanceDone(true)
          setClearanceModalOpen(false)
        }}
      />
    </div>
  )
}
