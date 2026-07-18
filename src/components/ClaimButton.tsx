'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, X } from 'lucide-react'

interface Props {
  entityId: string
  claimStatus: string
}

type Stage = 'idle' | 'form' | 'verify' | 'done'

export default function ClaimButton({ entityId, claimStatus }: Props) {
  const [stage, setStage] = useState<Stage>('idle')
  const [claimId, setClaimId] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [devCode, setDevCode] = useState('')  // shown in dev only
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', role: '', relationship: 'owner', method: 'email_domain',
  })

  if (claimStatus === 'verified') {
    return (
      <div className="flex items-center gap-1 text-sm text-green-400 font-medium">
        <ShieldCheck size={16} /> Verified
      </div>
    )
  }

  const handleSubmitClaim = async () => {
    setLoading(true)
    const res = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_id: entityId,
        submitter_name: form.name,
        submitter_email: form.email,
        submitter_role: form.role,
        relationship: form.relationship,
        verification_method: form.method,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setClaimId(data.claim_id)
      setDevCode(data.verification_code)
      setStage('verify')
    }
  }

  const handleVerify = async () => {
    setLoading(true)
    const res = await fetch('/api/claim', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId, code: verifyCode }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) setStage('done')
  }

  return (
    <>
      {stage === 'idle' && (
        <button
          className="text-sm px-4 py-2 rounded-full border border-[#3a3a3a] text-gray-400 hover:border-gray-500 hover:text-white transition-colors flex items-center gap-2"
          onClick={() => setStage('form')}
        >
          <ShieldCheck size={14} />
          {claimStatus === 'pending' ? 'Claim pending' : 'Claim this business'}
        </button>
      )}

      <AnimatePresence>
        {stage !== 'idle' && stage !== 'done' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl w-full max-w-md p-6"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold">Claim this business</h2>
                <button
                  className="text-gray-500 hover:text-white transition-colors"
                  onClick={() => setStage('idle')}
                >
                  <X size={20} />
                </button>
              </div>

              {stage === 'form' && (
                <div className="flex flex-col gap-4">
                  <p className="text-gray-400 text-sm">
                    Verify your ownership and manage your listing on NYC Discovery.
                  </p>
                  {[
                    { key: 'name', placeholder: 'Your name', type: 'text' },
                    { key: 'email', placeholder: 'Work email', type: 'email' },
                    { key: 'role', placeholder: 'Your role (e.g. Owner, Manager)', type: 'text' },
                  ].map(({ key, placeholder, type }) => (
                    <input
                      key={key}
                      type={type}
                      placeholder={placeholder}
                      className="w-full px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#3a3a3a] text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                      value={form[key as keyof typeof form]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    />
                  ))}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Relationship</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#3a3a3a] text-white focus:outline-none focus:border-gray-500"
                      value={form.relationship}
                      onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
                    >
                      <option value="owner">Owner</option>
                      <option value="manager">Manager</option>
                      <option value="employee">Employee</option>
                      <option value="marketing_agent">Marketing Agent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Verification method</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#3a3a3a] text-white focus:outline-none focus:border-gray-500"
                      value={form.method}
                      onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                    >
                      <option value="email_domain">Email at business domain</option>
                      <option value="phone">Call/text to business phone</option>
                      <option value="website_code">Add code to website</option>
                      <option value="social_account">Connect business social account</option>
                    </select>
                  </div>
                  <button
                    className="w-full py-3 rounded-full bg-[#ff4757] text-white font-bold hover:bg-[#ff6b78] transition-colors disabled:opacity-50"
                    onClick={handleSubmitClaim}
                    disabled={loading || !form.name || !form.email}
                  >
                    {loading ? 'Submitting…' : 'Submit claim'}
                  </button>
                </div>
              )}

              {stage === 'verify' && (
                <div className="flex flex-col gap-4">
                  <p className="text-gray-400 text-sm">
                    A verification code was sent. Enter it below to confirm ownership.
                  </p>
                  {devCode && (
                    <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-3 text-sm text-yellow-300">
                      <strong>Dev mode:</strong> Your code is <code className="font-mono text-yellow-200">{devCode}</code>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Enter verification code"
                    className="w-full px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#3a3a3a] text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 font-mono tracking-widest"
                    value={verifyCode}
                    onChange={e => setVerifyCode(e.target.value.toUpperCase())}
                    maxLength={8}
                  />
                  <button
                    className="w-full py-3 rounded-full bg-[#ff4757] text-white font-bold hover:bg-[#ff6b78] transition-colors disabled:opacity-50"
                    onClick={handleVerify}
                    disabled={loading || verifyCode.length < 4}
                  >
                    {loading ? 'Verifying…' : 'Verify'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {stage === 'done' && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setStage('idle')}
          >
            <div className="bg-[#1a1a1a] border border-green-800 rounded-2xl p-8 text-center max-w-sm">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold mb-2">Business verified!</h2>
              <p className="text-gray-400 text-sm">You can now manage your listing on NYC Discovery.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
