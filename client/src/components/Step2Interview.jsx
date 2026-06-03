import React, { useEffect, useRef, useState } from 'react'
import maleVideo from '../assets/videos/male-ai.mp4'
import femaleVideo from '../assets/videos/female-ai.mp4'
import Timer from './Timer'
import { motion } from 'motion/react'
import { ServerUrl } from '../App'
import { FaMicrophone, FaMicrophoneSlash } from 'react-icons/fa'
import axios from 'axios'
import { BsArrowLeft } from 'react-icons/bs'

const Step2Interview = ({ interviewData, onFinish }) => {
  const { interviewId, questions, userName } = interviewData

  const [isIntroPhase, setIsIntroPhase] = useState(true)
  const [isMicOn, setIsMicOn] = useState(false)

  const recognitionRef = useRef(null)
  const videoRef = useRef(null)

  const isMicOnRef = useRef(false) // FIX 1

  const [isAIPlaying, setIsAIPlaying] = useState(false)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState("")

  const [timeLeft, setTimeLeft] = useState(
    questions[0]?.timeLimit || 60
  )

  const [selectedVoice, setSelectedVoice] = useState(null)
  const [issubmitting, setIsSubmitting] = useState(false)

  const [voiceGender, setVoiceGender] = useState("female")
  const [subtitle, setSubtitle] = useState("")

  const currentQuestion = questions[currentIndex]
  const videoSrc = voiceGender === "male" ? maleVideo : femaleVideo

  // sync mic ref
  useEffect(() => {
    isMicOnRef.current = isMicOn
  }, [isMicOn])

  // ================= VOICES =================
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return

      const femaleVoice = voices.find(v =>
        v.name.toLowerCase().includes("zira") ||
        v.name.toLowerCase().includes("samantha") ||
        v.name.toLowerCase().includes("female")
      )

      const maleVoice = voices.find(v =>
        v.name.toLowerCase().includes("david") ||
        v.name.toLowerCase().includes("mark") ||
        v.name.toLowerCase().includes("male")
      )

      if (femaleVoice) {
        setSelectedVoice(femaleVoice)
        setVoiceGender("female")
      } else if (maleVoice) {
        setSelectedVoice(maleVoice)
        setVoiceGender("male")
      } else {
        setSelectedVoice(voices[0])
      }
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  // ================= SPEAK =================
  const speakTest = (text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !selectedVoice) {
        resolve()
        return
      }

      window.speechSynthesis.cancel()

      const humanTxt = text
        .replace(/,/g, ", ...")
        .replace(/\./g, ". ...")

      const utterance = new SpeechSynthesisUtterance(humanTxt)

      utterance.voice = selectedVoice
      utterance.rate = 0.92
      utterance.pitch = 1.05
      utterance.volume = 1

      utterance.onstart = () => {
        setIsAIPlaying(true)

        videoRef.current?.pause()
        if (videoRef.current) videoRef.current.currentTime = 0

        stopMic()
        videoRef.current?.play()
      }

      utterance.onend = () => {
        setIsAIPlaying(false)

        videoRef.current?.pause()
        if (videoRef.current) videoRef.current.currentTime = 0

        setTimeout(() => {
          setSubtitle("")
          resolve()

          if (isMicOnRef.current) {
            startMic()
          }
        }, 300)
      }

      setSubtitle(text)
      window.speechSynthesis.speak(utterance)
    })
  }

  // ================= INTRO =================
  useEffect(() => {
    if (!selectedVoice) return

    const runIntro = async () => {
      if (isIntroPhase) {
        await speakTest(`Hi ${userName}, it's great to meet you today.`)
        await speakTest(`Let's begin your interview.`)
        setIsIntroPhase(false)
      } else if (currentQuestion) {
        await new Promise(r => setTimeout(r, 800))
        await speakTest(currentQuestion.question)
      }
    }

    runIntro()
  }, [selectedVoice, isIntroPhase, currentIndex])

  // ================= TIMER =================
  useEffect(() => {
    if (isIntroPhase || !currentQuestion || feedback) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isIntroPhase, currentIndex, feedback])

  // ================= SPEECH RECOGNITION =================
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window)) return

    const recognition = new window.webkitSpeechRecognition()
    recognition.lang = "en-US"
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let finalTranscript = ""

      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " "
        }
      }

      if (finalTranscript.trim()) {
        setAnswer(prev => (prev + " " + finalTranscript).trim())
      }
    }

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setIsMicOn(false)
      }
    }

    recognition.onend = () => {
      if (isMicOn && !isAIPlaying && recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start()
          } catch (e) {}
        }, 500)
      }
    }

    recognitionRef.current = recognition

    return () => {
      try {
        recognition.stop()
        recognition.abort()
      } catch (e) {}
    }
  }, [isMicOn, isAIPlaying])

  // ================= MIC =================
  const startMic = () => {
    if (!recognitionRef.current || isAIPlaying) return
    try {
      recognitionRef.current.start()
    } catch (e) {}
  }

  const stopMic = () => {
    try {
      recognitionRef.current?.stop()
    } catch (e) {}
  }

  const toogleMic = async () => {
    if (isMicOn) {
      stopMic()
      setIsMicOn(false)
      return
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setIsMicOn(true)
      setTimeout(startMic, 300)
    } catch (error) {
      alert("Please allow microphone access")
    }
  }

  // ================= SUBMIT =================
  const submitAns = async () => {
    if (issubmitting) return

    stopMic()
    setIsSubmitting(true)

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/submit-ans",
        {
          interviewId,
          questionIndex: currentIndex,
          answer,
          timeTaken: currentQuestion.timeLimit - timeLeft,
        },
        { withCredentials: true }
      )

      setFeedback(result.data.feedback)
      await speakTest(result.data.feedback)

    } catch (error) {
      console.log(error)
    }

    setIsSubmitting(false)
  }

  // ================= NEXT =================
  const handleNext = async () => {
    setAnswer("")
    setFeedback("")

    const nextIndex = currentIndex + 1

    if (nextIndex >= questions.length) {
      finishInterview()
      return
    }

    await speakTest("Let's move to the next question.")

    setCurrentIndex(nextIndex)
    setTimeLeft(questions[nextIndex]?.timeLimit || 60)

    setTimeout(() => {
      if (isMicOnRef.current) startMic()
    }, 500)
  }

  // ================= FINISH =================
  const finishInterview = async () => {
    stopMic()
    setIsMicOn(false)

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/finish",
        { interviewId },
        { withCredentials: true }
      )

      onFinish?.(result.data)
    } catch (error) {
      console.log(error)
    }
  }

  // ================= AUTO SUBMIT =================
  useEffect(() => {
    if (isIntroPhase || !currentQuestion || feedback) return

    if (timeLeft === 0 && !issubmitting) {
      submitAns()
    }
  }, [timeLeft, feedback, isIntroPhase, currentQuestion, issubmitting])

  // ================= CLEANUP =================
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop()
        recognitionRef.current?.abort()
      } catch (e) {}

      window.speechSynthesis.cancel()
    }
  }, [])

  return (
    <div className='min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-100 flex items-center justify-center p-4 sm:p-6'>
      <div className='w-full max-w-350 min-h-[80vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col lg:flex-row overflow-hidden'>

        <div className='w-full lg:w-[35%] bg-white flex flex-col items-center p-6 space-y-6 border-r border-gray-200'>
          <div className='w-full max-w-md rounded-2xl overflow-hidden shadow-xl'>
            <video
              muted
              playsInline
              preload='auto'
              src={videoSrc}
              ref={videoRef}
              className='w-full h-auto object-cover'
            />
          </div>

          {subtitle && (
            <div className='w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm'>
              <p className='text-gray-700 text-sm sm:text-base font-medium text-center'>
                {subtitle}
              </p>
            </div>
          )}

          <div className='w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-md p-6 space-y-5'>
            <div className='flex justify-between items-center'>
              <span className='text-sm text-gray-500'>Interview Status</span>
              {isAIPlaying && <span className='text-sm font-semibold text-emerald-600'>AI Speaking</span>}
            </div>

            <Timer timeLeft={timeLeft} totalTime={currentQuestion?.timeLimit} />

            <div className='grid grid-cols-2 text-center'>
              <div>
                <div className='text-2xl font-bold text-emerald-600'>{currentIndex + 1}</div>
                <div className='text-xs'>Current</div>
              </div>
              <div>
                <div className='text-2xl font-bold text-emerald-600'>{questions.length}</div>
                <div className='text-xs'>Total</div>
              </div>
            </div>
          </div>
        </div>

        <div className='flex-1 flex flex-col p-6'>
          <h2 className='text-xl font-bold text-emerald-600 mb-6'>AI Smart Interview</h2>

          {!isIntroPhase && (
            <div className='mb-4 bg-gray-50 p-4 rounded-xl border'>
              {currentQuestion?.question}
            </div>
          )}

          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className='flex-1 bg-gray-100 p-4 rounded-xl outline-none'
            placeholder='Speak or type your answer'
          />

          {!feedback ? (
            <div className='flex gap-4 mt-4'>
              <button onClick={toogleMic} className='bg-black text-white px-4 py-2 rounded-full'>
                {isMicOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </button>

              <button
                onClick={submitAns}
                disabled={issubmitting}
                className='flex-1 bg-emerald-600 text-white rounded-xl'
              >
                {issubmitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          ) : (
            <div className='mt-4 p-4 bg-emerald-50 border rounded-xl'>
              <p>{feedback}</p>

              <button onClick={handleNext} className='mt-3 bg-emerald-600 text-white w-full py-2 rounded-xl'>
                Next Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Step2Interview
