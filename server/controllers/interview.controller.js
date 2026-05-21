import fs from 'fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { askAi } from '../services/openRouter.services.js'
import User from '../models/User.model.js'
import Interview from '../models/Interview.model.js'

// =========================
// CLEAN AI JSON RESPONSE
// =========================
const cleanAIJson = (text) => {
    return text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim()
}

export const analyzeResume = async (req, res) => {
    try {

        if (!req.file) {
            return res.status(400).json({
                message: "Resume required"
            })
        }

        const filePath = req.file.path

        const fileBuffer = await fs.promises.readFile(filePath)

        const unit8Array = new Uint8Array(fileBuffer)

        const pdf = await pdfjsLib.getDocument({
            data: unit8Array
        }).promise

        let resumeText = ""

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {

            const page = await pdf.getPage(pageNum)

            const content = await page.getTextContent()

            const pageText = content.items
                .map(item => item.str)
                .join(" ")

            resumeText += pageText + "\n"
        }

        resumeText = resumeText.replace(/\s+/g, " ").trim()

        const messages = [
            {
                role: "system",
                content: `
                Extract structured data from resume.
                
                Return strictly JSON:
                {
                "role":"string",
                "experience":"string",
                "projects":["project1","project2"],
                "skills":["skill1","skill2"]
                }`
            },
            {
                role: "user",
                content: resumeText
            }
        ]

        const aiResponse = await askAi(messages)

        // =========================
        // FIX AI JSON PARSE
        // =========================
        const cleanedResponse = cleanAIJson(aiResponse)

        const parsed = JSON.parse(cleanedResponse)

        fs.unlinkSync(filePath)

        return res.json({
            role: parsed.role,
            experience: parsed.experience,
            projects: parsed.projects,
            skills: parsed.skills,
            resumeText
        })

    } catch (error) {

        console.log(error)

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        }

        return res.status(500).json({
            message: error.message
        })
    }
}

export const generateQues = async (req, res) => {
    try {

        let { role, experience, mode, skills, resumeText, projects } = req.body

        role = role?.trim()
        experience = experience?.trim()
        mode = mode?.trim()

        if (!role || !experience || !mode) {
            return res.status(400).json({
                message: "Role , experience and mode are required"
            })
        }

        const user = await User.findById(req.userId)

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            })
        }

        if (user.credits < 50) {
            return res.status(400).json({
                message: "Not enough credits. Minimum 50 required"
            })
        }

        const projectText =
            Array.isArray(projects) && projects.length
                ? projects.join(", ")
                : "None"

        const skillsText =
            Array.isArray(skills) && skills.length
                ? skills.join(", ")
                : "None"

        const safeResume = resumeText?.trim() || "None"

        const userPrompt = `
        Role:${role}
        Experience:${experience}
        Interview Mode:${mode}
        Projects:${projectText}
        Skills:${skillsText}
        Resume:${safeResume}`

        if (!userPrompt.trim()) {
            return res.status(400).json({
                message: "Prompt content is empty"
            })
        }

        const messages = [
            {
                role: "system",
                content: `
You are a real human interviewer conducting a professional interview.

Speak in simple, natural English as if you are directly talking to the candidate.

Generate exactly 5 interview questions.

Strict Rules:

-Each question must contain between 15 and 25 words.
-Each question must be a single complete sentence.
-Do NOT number them.
-Do NOT add explanations.
-Do NOT add extra text before or after.
-One question per line only.
-Keep language simple and conversational.
-Questions must feel practical and realistic.

Difficulty progression:
Question 1 → easy
Question 2 → easy
Question 3 → medium
Question 4 → medium
Question 5 → hard

More questions based on the candidates role, experience,
projects, skills and resume details.`
            },
            {
                role: "user",
                content: userPrompt
            }
        ]

        const aiResponse = await askAi(messages)

        if (!aiResponse || !aiResponse.trim()) {
            return res.status(500).json({
                message: "AI returned empty response."
            })
        }

        const questionsArray = aiResponse
            .split("\n")
            .map(q => q.trim())
            .filter(q => q.length > 0)
            .slice(0, 5)

        if (questionsArray.length === 0) {
            return res.status(500).json({
                message: "AI failed to generate questions."
            })
        }

        user.credits -= 50

        await user.save()

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText: safeResume,

            questions: questionsArray.map((q, index) => ({
                question: q,
                difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
                timeLimit: [60, 60, 90, 90, 120][index]
            }))
        })

        return res.json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            questions: interview.questions
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            message: error.message
        })
    }
}

export const submitAns = async (req, res) => {
    try {

        const {
            interviewId,
            questionIndex,
            answer,
            timeTaken
        } = req.body

        const interview = await Interview.findById(interviewId)

        // =========================
        // SAFETY CHECKS
        // =========================
        if (!interview) {
            return res.status(404).json({
                message: "Interview not found"
            })
        }

        const question = interview.questions[questionIndex]

        if (!question) {
            return res.status(404).json({
                message: "Question not found"
            })
        }

        if (!answer) {

            question.score = 0
            question.feedback = "You did not submit an answer"
            question.answer = ""

            await interview.save()

            return res.json({
                feedback: question.feedback
            })
        }

        if (timeTaken > question.timeLimit) {

            question.score = 0
            question.feedback = "Time Limit exceeded"
            question.answer = ""

            await interview.save()

            return res.json({
                feedback: question.feedback
            })
        }

        const messages = [
            {
                role: "system",
                content:
                    `You are a professional human interviewer evaluating a candidate's answer in a real interview.

Evaluate naturally and fairly.

Score:
1. Confidence
2. Communication
3. Correctness

Return ONLY valid JSON:

{
"confidence": number,
"communication": number,
"correctness": number,
"finalScore": number,
"feedback": "short human feedback"
}`
            },
            {
                role: "user",
                content: `
Question:${question.question}
Answer:${answer}`
            }
        ]

        const aiResponse = await askAi(messages)

        // =========================
        // FIX AI JSON PARSE
        // =========================
        const cleanedResponse = cleanAIJson(aiResponse)

        const parsed = JSON.parse(cleanedResponse)

        question.answer = answer
        question.confidence = parsed.confidence || 0
        question.communication = parsed.communication || 0
        question.correctness = parsed.correctness || 0
        question.score = parsed.finalScore || 0
        question.feedback = parsed.feedback || "Good attempt"

        await interview.save()

        return res.status(200).json({
            feedback: parsed.feedback
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            message: `Failed to submit answer ${error.message}`
        })
    }
}

export const finishInterview = async (req, res) => {
    try {

        const { interviewId } = req.body

        const interview = await Interview.findById(interviewId)

        if (!interview) {
            return res.status(404).json({
                message: "Failed to find interview"
            })
        }

        const totalQuestions = interview.questions?.length || 0

        let totalScore = 0
        let totalConfidence = 0
        let totalCommunication = 0
        let totalCorrectness = 0

        interview.questions.forEach((q) => {

            totalScore += q.score || 0
            totalConfidence += q.confidence || 0
            totalCommunication += q.communication || 0
            totalCorrectness += q.correctness || 0
        })

        const finalScore = totalQuestions
            ? totalScore / totalQuestions
            : 0

        const avgConfidence = totalQuestions
            ? totalConfidence / totalQuestions
            : 0

        const avgCommunication = totalQuestions
            ? totalCommunication / totalQuestions
            : 0

        const avgCorrectness = totalQuestions
            ? totalCorrectness / totalQuestions
            : 0

        interview.finalScore = finalScore
        interview.status = "Completed"

        await interview.save()

        return res.status(200).json({
            finalScore: Number(finalScore.toFixed(1)),
            confidence: Number(avgConfidence.toFixed(1)),
            communication: Number(avgCommunication.toFixed(1)),
            correctness: Number(avgCorrectness.toFixed(1)),

            questionWiseScore: interview.questions.map((q) => ({
                question: q.question,
                score: q.score || 0,
                feedback: q.feedback || "",
                confidence: q.confidence || 0,
                communication: q.communication || 0,
                correctness: q.correctness || 0,
            })),
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            message: `Failed to finish interview ${error.message}`
        })
    }
}

export const getMyInterviews = async (req, res) => {
    try {
        const interview = await Interview.find({ userId: req.userId })
            .sort({ createdAt: -1 }).select("role experience mode finalScore status craetedAt")

        return res.status(200).json(interview)
    } catch (error) {
        return res.status(500).json({ message: `Failed to find current user interview ${error}` })
    }
}

export const getInterviewReport = async (req, res) => {
    try {

        const interview = await Interview.findById(req.params.id)

        if (!interview) {
            return res.status(404).json({
                message: "Interview not found"
            })
        }

        const totalQuestions = interview.questions?.length || 0

        let totalConfidence = 0
        let totalCommunication = 0
        let totalCorrectness = 0

        interview.questions.forEach((q) => {

            totalConfidence += q.confidence || 0
            totalCommunication += q.communication || 0
            totalCorrectness += q.correctness || 0
        })

        const avgConfidence = totalQuestions
            ? totalConfidence / totalQuestions
            : 0

        const avgCommunication = totalQuestions
            ? totalCommunication / totalQuestions
            : 0

        const avgCorrectness = totalQuestions
            ? totalCorrectness / totalQuestions
            : 0

        return res.status(200).json({

            finalScore: interview.finalScore || 0,

            confidence: Number(avgConfidence.toFixed(1)),

            communication: Number(avgCommunication.toFixed(1)),

            correctness: Number(avgCorrectness.toFixed(1)),

            questionWiseScore: interview.questions.map((q) => ({
                question: q.question,
                answer: q.answer,
                feedback: q.feedback,
                score: q.score,
                confidence: q.confidence,
                communication: q.communication,
                correctness: q.correctness,
                difficulty: q.difficulty
            }))
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            message: `Failed to find interview report ${error.message}`
        })
    }
}