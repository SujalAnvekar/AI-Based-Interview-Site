// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from 'firebase/auth'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "interviewiq-5197e.firebaseapp.com",
  projectId: "interviewiq-5197e",
  storageBucket: "interviewiq-5197e.firebasestorage.app",
  messagingSenderId: "158824415383",
  appId: "1:158824415383:web:969beb90531340b4b4a9d2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth=getAuth(app)
const provider=new GoogleAuthProvider()
export {auth,provider}