import { initializeApp } from "firebase/app";
import { getFirestore, getDocs, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDABXfuMeGsTO1rxGihBTDGauIJcZ1fJGU",
  authDomain: "saeed-anzi-wedding.firebaseapp.com",
  projectId: "saeed-anzi-wedding",
  storageBucket: "saeed-anzi-wedding.firebasestorage.app",
  messagingSenderId: "889701160746",
  appId: "1:889701160746:web:33a62691f510466b46f053",
  measurementId: "G-RFQDD5Q52V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkVisits() {
  const snapshot = await getDocs(collection(db, "visits"));
  console.log(`Found ${snapshot.size} visits.`);
  snapshot.forEach(doc => {
      const data = doc.data();
      console.log(data.device, data.timestamp);
  });
}
checkVisits();
