import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCT_q3KuVKaQZ_42xYtRa2zhwbw5TZ1DAQ",
  authDomain: "animalhealthpkapp.firebaseapp.com",
  projectId: "animalhealthpkapp",
  storageBucket: "animalhealthpkapp.firebasestorage.app",
  messagingSenderId: "467600105250",
  appId: "1:467600105250:web:12e44e1c8d294911a58f7b",
  measurementId: "G-RS28EF3TKW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, onSnapshot, doc, setDoc, deleteDoc };
