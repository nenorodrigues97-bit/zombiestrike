// Firebase Configuration — ZombieStrike
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update, push, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAiRX133DujzRExSw7gFZpgvi1sZXQPiSk",
  authDomain: "zombiestrike-4e7e5.firebaseapp.com",
  databaseURL: "https://zombiestrike-4e7e5-default-rtdb.firebaseio.com",
  projectId: "zombiestrike-4e7e5",
  storageBucket: "zombiestrike-4e7e5.firebasestorage.app",
  messagingSenderId: "50235929205",
  appId: "1:50235929205:web:f19c95e3aeb07b1d4ebe3c"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, onValue, update, push, remove, onDisconnect };
