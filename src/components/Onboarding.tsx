'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'

const NEIGHBORHOODS = [
  'Lower East Side', 'East Village', 'West Village', 'SoHo', 'Tribeca',
  'Williamsburg', 'Bushwick', 'Park Slope', 'Crown Heights', 'DUMBO',
  'Astoria', 'Long Island City', 'Harlem', 'Upper West Side', 'Upper East Side',
  'Chelsea', 'Hell\'s Kitchen', 'Midtown', 'Greenpoint', 'Bedford-Stuyvesant',
  'Prospect Heights', 'Carroll Gardens', 'Cobble Hill', 'Fort Greene', 'Ridgewood',
]

const INTEREST_TAGS = [
  'Fine dining', 'Cocktail bars', 'Ramen', 'Pizza', 'Tacos', 'Brunch',
  'Live music', 'Comedy', 'Theater', 'Art galleries', 'Dance parties',
  'Film screenings', 'Pottery', 'Painting', 'Woodworking', 'Cooking classes',
  'Yoga', 'Boxing', 'Rock climbing', 'Dance classes',
  'Farmers markets', 'Pop-up shops', 'Food festivals', 'Book clubs',
  'Trivia nights', 'Karaoke', 'Board games', 'Drag shows', 'Jazz',
]

const TIME_PREFS = [
  { value: 'weekday_days', label: 'Weekday days' },
  { value: 'weekday_evenings', label: 'Weekday evenings' },
  { value: 'weekend_days', label: 'Weekend days' },
  { value: 'weekend_nights', label: 'Weekend nights' },
  { value: 'late_nights', label: 'Late nights' },
]

type Step = 'welcome' | 'neighborhoods' | 'interests' | 'preferences' | 'done'

interface Prefs {
  neighborhoods: string[]
  interests: string[]
  price_sensitivity: number
  time_prefs: string[]
  indoor_outdoor: string
  solo_or_group: string
}

function toggle<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

const variants = {
  enter: { opacity: 0, x: 40 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
}

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [prefs, setPrefs] = useState<Prefs>({
    neighborhoods: [],
    interests: [],
    price_sensitivity: 2,
    time_prefs: [],
    indoor_outdoor: 'both',
    solo_or_group: 'both',
  })
  const [saving, setSaving] = useState(false)

  const handleFinish = async () => {
    setSaving(true)
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        neighborhood_prefs: prefs.neighborhoods,
        interest_tags: prefs.interests,
        price_sensitivity: prefs.price_sensitivity,
        time_prefs: prefs.time_prefs,
        indoor_outdoor: prefs.indoor_outdoor,
        solo_or_group: prefs.solo_or_group,
      }),
    })
    router.push('/feed')
  }

  const steps: Step[] = ['welcome', 'neighborhoods', 'interests', 'preferences', 'done']
  const stepIndex = steps.indexOf(step)
  const progress = (stepIndex / (steps.length - 1)) * 100

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      {/* Progress bar */}
      {step !== 'welcome' && (
        <div className="w-full max-w-lg mb-8">
          <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#ff4757] rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            className="text-center max-w-lg"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <div className="text-7xl mb-6">🗽</div>
            <h1 className="text-4xl font-black mb-4">NYC Discovery</h1>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">
              Discover the best restaurants, classes, shows, and events in New York City —
              personalized for you.
            </p>
            <button
              className="px-8 py-4 bg-[#ff4757] text-white rounded-full text-lg font-bold hover:bg-[#ff6b78] transition-colors"
              onClick={() => setStep('neighborhoods')}
            >
              Let&apos;s get started →
            </button>
            <p className="text-gray-600 text-sm mt-4">
              Takes about 1 minute
            </p>
          </motion.div>
        )}

        {step === 'neighborhoods' && (
          <motion.div
            key="neighborhoods"
            className="w-full max-w-lg"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <h2 className="text-2xl font-bold mb-2">Where do you hang out?</h2>
            <p className="text-gray-400 mb-6">Pick your favorite NYC neighborhoods (or skip)</p>
            <div className="flex flex-wrap gap-2 mb-8 max-h-72 overflow-y-auto pr-1">
              {NEIGHBORHOODS.map(nb => (
                <button
                  key={nb}
                  className="px-3 py-2 rounded-full text-sm transition-all border"
                  style={{
                    background: prefs.neighborhoods.includes(nb) ? '#ff4757' : 'transparent',
                    borderColor: prefs.neighborhoods.includes(nb) ? '#ff4757' : '#3a3a3a',
                    color: prefs.neighborhoods.includes(nb) ? '#fff' : '#999',
                  }}
                  onClick={() => setPrefs(p => ({ ...p, neighborhoods: toggle(p.neighborhoods, nb) }))}
                >
                  {nb}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 rounded-full border border-[#3a3a3a] text-gray-400 hover:border-gray-500 transition-colors"
                onClick={() => setStep('interests')}
              >
                Skip
              </button>
              <button
                className="flex-1 py-3 rounded-full bg-[#ff4757] text-white font-bold hover:bg-[#ff6b78] transition-colors"
                onClick={() => setStep('interests')}
              >
                Next →
              </button>
            </div>
          </motion.div>
        )}

        {step === 'interests' && (
          <motion.div
            key="interests"
            className="w-full max-w-lg"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <h2 className="text-2xl font-bold mb-2">What are you into?</h2>
            <p className="text-gray-400 mb-6">Pick anything that sounds fun</p>
            <div className="flex flex-wrap gap-2 mb-8 max-h-72 overflow-y-auto pr-1">
              {INTEREST_TAGS.map(tag => (
                <button
                  key={tag}
                  className="px-3 py-2 rounded-full text-sm transition-all border"
                  style={{
                    background: prefs.interests.includes(tag) ? '#ff4757' : 'transparent',
                    borderColor: prefs.interests.includes(tag) ? '#ff4757' : '#3a3a3a',
                    color: prefs.interests.includes(tag) ? '#fff' : '#999',
                  }}
                  onClick={() => setPrefs(p => ({ ...p, interests: toggle(p.interests, tag) }))}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 rounded-full border border-[#3a3a3a] text-gray-400 hover:border-gray-500 transition-colors"
                onClick={() => setStep('preferences')}
              >
                Skip
              </button>
              <button
                className="flex-1 py-3 rounded-full bg-[#ff4757] text-white font-bold hover:bg-[#ff6b78] transition-colors"
                onClick={() => setStep('preferences')}
              >
                Next →
              </button>
            </div>
          </motion.div>
        )}

        {step === 'preferences' && (
          <motion.div
            key="preferences"
            className="w-full max-w-lg"
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            <h2 className="text-2xl font-bold mb-6">A few more details</h2>

            {/* Price sensitivity */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-3 block">Budget</label>
              <div className="flex gap-3">
                {[
                  { val: 1, label: '$', desc: 'Budget' },
                  { val: 2, label: '$$', desc: 'Moderate' },
                  { val: 3, label: '$$$', desc: 'Splurge' },
                ].map(({ val, label, desc }) => (
                  <button
                    key={val}
                    className="flex-1 py-3 rounded-xl border text-center transition-all"
                    style={{
                      background: prefs.price_sensitivity === val ? '#ff4757' : 'transparent',
                      borderColor: prefs.price_sensitivity === val ? '#ff4757' : '#3a3a3a',
                      color: prefs.price_sensitivity === val ? '#fff' : '#999',
                    }}
                    onClick={() => setPrefs(p => ({ ...p, price_sensitivity: val }))}
                  >
                    <div className="font-bold">{label}</div>
                    <div className="text-xs opacity-70">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* When */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-3 block">When are you free?</label>
              <div className="flex flex-wrap gap-2">
                {TIME_PREFS.map(({ value, label }) => (
                  <button
                    key={value}
                    className="px-3 py-2 rounded-full text-sm transition-all border"
                    style={{
                      background: prefs.time_prefs.includes(value) ? '#ff4757' : 'transparent',
                      borderColor: prefs.time_prefs.includes(value) ? '#ff4757' : '#3a3a3a',
                      color: prefs.time_prefs.includes(value) ? '#fff' : '#999',
                    }}
                    onClick={() => setPrefs(p => ({ ...p, time_prefs: toggle(p.time_prefs, value) }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Indoor/Outdoor */}
            <div className="mb-6">
              <label className="text-sm text-gray-400 mb-3 block">Setting</label>
              <div className="flex gap-3">
                {[
                  { val: 'indoor', label: '🏠 Indoor' },
                  { val: 'outdoor', label: '🌳 Outdoor' },
                  { val: 'both', label: '🔀 Both' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    className="flex-1 py-3 rounded-xl border text-sm transition-all"
                    style={{
                      background: prefs.indoor_outdoor === val ? '#ff4757' : 'transparent',
                      borderColor: prefs.indoor_outdoor === val ? '#ff4757' : '#3a3a3a',
                      color: prefs.indoor_outdoor === val ? '#fff' : '#999',
                    }}
                    onClick={() => setPrefs(p => ({ ...p, indoor_outdoor: val }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Solo/Group */}
            <div className="mb-8">
              <label className="text-sm text-gray-400 mb-3 block">Vibe</label>
              <div className="flex gap-3">
                {[
                  { val: 'solo', label: '🙋 Solo' },
                  { val: 'group', label: '👫 Group' },
                  { val: 'both', label: '🔀 Either' },
                ].map(({ val, label }) => (
                  <button
                    key={val}
                    className="flex-1 py-3 rounded-xl border text-sm transition-all"
                    style={{
                      background: prefs.solo_or_group === val ? '#ff4757' : 'transparent',
                      borderColor: prefs.solo_or_group === val ? '#ff4757' : '#3a3a3a',
                      color: prefs.solo_or_group === val ? '#fff' : '#999',
                    }}
                    onClick={() => setPrefs(p => ({ ...p, solo_or_group: val }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className="w-full py-4 rounded-full bg-[#ff4757] text-white font-bold text-lg hover:bg-[#ff6b78] transition-colors disabled:opacity-50"
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? 'Setting up your feed…' : 'Show my feed →'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
