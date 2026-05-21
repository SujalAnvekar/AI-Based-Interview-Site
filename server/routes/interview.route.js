import express from 'express'
import isAuth from '../middlewares/isAuth.js'
import { upload } from '../middlewares/multer.js'
import {
    analyzeResume, finishInterview, generateQues,
    getInterviewReport, getMyInterviews, submitAns
} from '../controllers/interview.controller.js'

const interviewRouter = express.Router()

interviewRouter.post('/resume', isAuth, upload.single("resume"), analyzeResume)
interviewRouter.post('/generate-questions', isAuth, generateQues)
interviewRouter.post('/submit-ans', isAuth, submitAns)
interviewRouter.post('/finish', isAuth, finishInterview)
interviewRouter.get('/get-interview', isAuth, getMyInterviews)
interviewRouter.get('/report/:id', isAuth, getInterviewReport)

export default interviewRouter