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

  const videoRef = useRef(null)

  const currentQuestion = questions[currentIndex]

  // =========================
  // LOAD VOICES
  // =========================
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices()

      if (!voices.length) return

      const femaleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("zira") ||
          v.name.toLowerCase().includes("samantha") ||
          v.name.toLowerCase().includes("female")
      )

      if (femaleVoice) {
        setSelectedVoice(femaleVoice)
        setVoiceGender("female")
        return
      }

      const maleVoice = voices.find(
        (v) =>
          v.name.toLowerCase().includes("david") ||
          v.name.toLowerCase().includes("mark") ||
          v.name.toLowerCase().includes("male")
      )

      if (maleVoice) {
        setSelectedVoice(maleVoice)
        setVoiceGender("male")
        return
      }

      setSelectedVoice(voices[0])
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }, [])

  const videoSrc = voiceGender === "male" ? maleVideo : femaleVideo

  // =========================
  // SPEAK FUNCTION
  // =========================
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
        videoRef.current?.pause()
        videoRef.current.currentTime = 0

        setIsAIPlaying(true)

        stopMic()

        videoRef.current?.play()
      }

      utterance.onend = () => {
        videoRef.current?.pause()
        videoRef.current.currentTime = 0

        setIsAIPlaying(false)

        if (isMicOn) {
          startMic()
        }

        setTimeout(() => {
          setSubtitle("")
          resolve()
        }, 300)
      }

      setSubtitle(text)

      window.speechSynthesis.speak(utterance)
    })
  }

  // =========================
  // INTRO + QUESTION SPEAK
  // =========================
  useEffect(() => {
    if (!selectedVoice) return

    const runIntro = async () => {
      if (isIntroPhase) {
        await speakTest(
          `Hi ${userName}, it's great to meet you today. I hope you are feeling confident and ready.`
        )

        await speakTest(
          `I'll ask you a few questions. Just answer naturally and take your time. Let's begin.`
        )

        setIsIntroPhase(false)
      } else if (currentQuestion) {
        await new Promise((r) => setTimeout(r, 800))

        if (currentIndex === questions.length - 1) {
          await speakTest(
            "Alright, this one might be a bit more challenging."
          )
        }

        await speakTest(currentQuestion.question)
      }
    }

    runIntro()
  }, [selectedVoice, isIntroPhase, currentIndex])

  // =========================
  // TIMER
  // =========================
  useEffect(() => {
    if (isIntroPhase) return
    if (!currentQuestion) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }

        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isIntroPhase, currentIndex])

  // =========================
  // SPEECH RECOGNITION
  // =========================
  // =========================
// SPEECH RECOGNITION
// =========================
useEffect(() => {
  if (!("webkitSpeechRecognition" in window)) {
    console.log("Speech Recognition not supported")
    return
  }

  const recognition = new window.webkitSpeechRecognition()

  recognition.lang = "en-US"
  recognition.continuous = true
  recognition.interimResults = true

  recognition.onstart = () => {
    console.log("Recognition Started")
  }

  // =========================
  // FIXED TRANSCRIPT LOOPING
  // =========================
  recognition.onresult = (event) => {
    let finalTranscript = ""

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript

      // Only final results
      if (event.results[i].isFinal) {
        finalTranscript += transcript + " "
      }
    }

    // Prevent duplicate append
    if (finalTranscript.trim()) {
      setAnswer((prev) => {
        if (prev.endsWith(finalTranscript.trim())) {
          return prev
        }

        return (prev + " " + finalTranscript).trim()
      })
    }
  }

  recognition.onerror = (event) => {
    console.log("Recognition Error:", event.error)

    if (
      event.error === "aborted" ||
      event.error === "no-speech"
    ) {
      return
    }

    if (event.error === "not-allowed") {
      setIsMicOn(false)
    }
  }

  recognition.onend = () => {
    console.log("Recognition Ended")

    // FIXED AUTO RESTART
    if (
      isMicOn &&
      !isAIPlaying &&
      recognitionRef.current
    ) {
      setTimeout(() => {
        try {
          recognition.start()
        } catch (err) {
          console.log(err)
        }
      }, 500)
    }
  }

  recognitionRef.current = recognition

  return () => {
    recognition.stop()
  }
}, [isMicOn, isAIPlaying])

  // =========================
  // MIC FUNCTIONS
  // =========================
  const startMic = () => {
    if (recognitionRef.current && !isAIPlaying) {
      try {
        recognitionRef.current.start()
      } catch (err) {
        console.log(err)
      }
    }
  }

  const stopMic = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const toogleMic = async () => {
    if (isMicOn) {
      stopMic()
      setIsMicOn(false)
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        })

        startMic()
        setIsMicOn(true)
      } catch (error) {
        console.log("Mic Permission Error:", error)
        alert("Please allow microphone access")
      }
    }
  }

  // =========================
  // SUBMIT ANSWER
  // =========================
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
          timeTaken:
            currentQuestion.timeLimit - timeLeft,
        },
        { withCredentials: true }
      )

      setFeedback(result.data.feedback)

      speakTest(result.data.feedback)

      setIsSubmitting(false)
    } catch (error) {
      console.log(error)
      setIsSubmitting(false)
    }
  }

  // =========================
  // NEXT QUESTION
  // =========================
  const handleNext = async () => {
    setAnswer("")
    setFeedback("")

    if (currentIndex + 1 >= questions.length) {
      finishInterview()
      return
    }

    await speakTest(
      "Alright, let's move to the next question."
    )

    setCurrentIndex(currentIndex + 1)

    setTimeLeft(
      questions[currentIndex + 1]?.timeLimit || 60
    )

    setTimeout(() => {
      if (isMicOn) startMic()
    }, 500)
  }

  // =========================
  // FINISH INTERVIEW
  // =========================
  const finishInterview = async () => {
    stopMic()
    setIsMicOn(false)

    try {
      const result = await axios.post(
        ServerUrl + "/api/interview/finish",
        {
          interviewId,
        },
        { withCredentials: true }
      )

      console.log(result.data)

      if (onFinish) {
        onFinish(result.data)
      }
    } catch (error) {
      console.log(error)
    }
  }

  // =========================
  // AUTO SUBMIT
  // =========================
  useEffect(() => {
    if (
      isIntroPhase ||
      !currentQuestion
    )
      return

    if (
      timeLeft === 0 &&
      !issubmitting &&
      !feedback
    ) {
      submitAns()
    }
  }, [timeLeft])

  // =========================
  // CLEANUP
  // =========================
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current.abort()
      }

      window.speechSynthesis.cancel()
    }
  }, [])

  return (
    <div
      className='min-h-screen bg-linear-to-br from-emerald-50 via-white
    to-teal-100 flex items-center justify-center p-4 sm:p-6'
    >
      <div
        className='w-full max-w-350 min-h-[80vh] bg-white rounded-3xl
      shadow-2xl border border-gray-200 flex flex-col lg:flex-row
      overflow-hidden'
      >
        {/* VIDEO SECTION */}
        <div
          className='w-full lg:w-[35%] bg-white flex flex-col items-center p-6
space-y-6 border-r border-gray-200'
        >
          <div className='w-full max-w-md rounded-2xl overflow-hidden shadow-xl'>
            <video
              muted
              playsInline
              preload='auto'
              src={videoSrc}
              key={videoSrc}
              ref={videoRef}
              className='w-full h-auto object-cover'
            />
          </div>

          {/* SUBTITLE */}
          {subtitle && (
            <div
              className='w-full max-w-md bg-gray-50 border border-gray-200 rounded-xl
  p-4 shadow-sm'
            >
              <p
                className='text-gray-700 text-sm sm:text-base font-medium
    text-center leading-relaxed'
              >
                {subtitle}
              </p>
            </div>
          )}

          <div
            className='w-full max-w-md bg-white border border-gray-200 rounded-2xl
   shadow-md p-6 space-y-5'
          >
            <div className='flex justify-between items-center'>
              <span className='text-sm text-gray-500'>
                Interview Status
              </span>

              {isAIPlaying && (
                <span className='text-sm font-semibold text-emerald-600'>
                  AI Speaking
                </span>
              )}
            </div>

            <div className='h-px bg-gray-300'></div>

            <div className='flex justify-center'>
              <Timer
                timeLeft={timeLeft}
                totalTime={currentQuestion?.timeLimit}
              />
            </div>

            <div className='h-px bg-gray-300'></div>

            <div className='grid grid-cols-2 gap-6 text-center'>
              <div>
                <span className='text-2xl font-bold text-emerald-600'>
                  {currentIndex + 1}
                </span>

                <div className='text-xs text-gray-600'>
                  Current Question
                </div>
              </div>

              <div>
                <span className='text-2xl font-bold text-emerald-600'>
                  {questions.length}
                </span>

                <div className='text-xs text-gray-600'>
                  Total Questions
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* TEXT SECTION */}
        <div className='flex-1 flex flex-col p-4 sm:p-6 md:p-8 relative'>
          <h2 className='text-xl sm:text-2xl font-bold text-emerald-600 mb-6'>
            AI Smart Interview
          </h2>

          {!isIntroPhase && (
            <div
              className='relative mb-6 bg-gray-50 p-4 sm:p-6 rounded-2xl border
border-gray-200 shadow-sm'
            >
              <p className='text-xs sm:text-sm text-gray-600 mb-2'>
                Question {currentIndex + 1} of {questions.length}
              </p>

              <div className='text-base sm:text-lg font-semibold text-gray-800 leading-relaxed pr-16'>
                {currentQuestion?.question}
              </div>
            </div>
          )}

          <textarea
            onChange={(e) => setAnswer(e.target.value)}
            value={answer}
            placeholder='Speak or type your answer here...'
            className='flex-1 bg-gray-100 p-4 sm:p-6 rounded-2xl resize-none outline-none
border border-gray-200 focus:ring-2 focus:ring-emerald-500 transition text-gray-800'
          />

          {!feedback ? (
            <div className='flex items-center gap-4 mt-6'>
              <motion.button
                onClick={toogleMic}
                whileTap={{ scale: 0.9 }}
                className='w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center
rounded-full bg-black text-white shadow-lg'
              >
                {isMicOn ? (
                  <FaMicrophone size={20} />
                ) : (
                  <FaMicrophoneSlash size={20} />
                )}
              </motion.button>

              <motion.button
                onClick={submitAns}
                disabled={issubmitting}
                whileTap={{ scale: 0.95 }}
                className='flex-1 bg-linear-to-br from-emerald-600 to-teal-500
text-white py-3 sm:py-4 rounded-2xl shadow-lg hover:opacity-90 transition font-semibold disabled:bg-gray-500'
              >
                {issubmitting
                  ? "Submitting..."
                  : "Submit Answer"}
              </motion.button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className='mt-6 bg-emerald-50 border border-emerald-200
            p-5 rounded-2xl shadow-sm'
            >
              <p className='text-emerald-700 font-medium mb-4'>
                {feedback}
              </p>

              <button
                onClick={handleNext}
                className='w-full bg-linear-to-br from-emerald-600 to-teal-500
text-white py-3 rounded-xl shadow-md hover:opacity-90 transition flex items-center justify-center
gap-1'
              >
                Next Question

                <BsArrowLeft
                  size={18}
                  className='rotate-180'
                />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Step2Interview
