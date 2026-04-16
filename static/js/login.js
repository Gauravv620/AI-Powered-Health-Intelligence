console.log("login.js loaded");


// ================= FIREBASE CONFIG =================

const firebaseConfig = {
  apiKey: "AIzaSyBqkMcOkj8v2_9pKEJB35YivVeyoJ7brwQ",
  authDomain: "healthai-25824.firebaseapp.com",
  projectId: "healthai-25824",
  storageBucket: "healthai-25824.firebasestorage.app",
  messagingSenderId: "404563155530",
  appId: "1:404563155530:web:c5ff86bce4ce019ce5a4b3"
};

// INIT FIREBASE
firebase.initializeApp(firebaseConfig);


// ================= LOGIN =================

function loginUser() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Please enter email and password");
        return;
    }

    fetch('/login-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        console.log(data);

        if (data.success) {
            // 🔥 FIXED (break iframe)
            window.top.location.href = "/dashboard";
        } else {
            alert(data.message);
        }
    })
    .catch(err => {
        console.error(err);
        alert("Server error");
    });
}


// ================= PASSWORD TOGGLE =================

function togglePassword() {
    const pass = document.getElementById("password");
    pass.type = pass.type === "password" ? "text" : "password";
}


// ================= FACE LOGIN =================

let videoStream = null;
let interval = null;

function openFaceScan(){
    const email = document.getElementById("email").value;

    if(!email){
        alert("Enter email first");
        return;
    }

    document.getElementById("faceModal").style.display = "flex";

    const video = document.getElementById("video");

    navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
        video.srcObject = stream;
        videoStream = stream;
    });

    startFaceVerification(email);
}

// CONTINUOUS CHECK
function startFaceVerification(email){
    let attempts = 0;

    interval = setInterval(() => {

        fetch('/face-login', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({email})
        })
        .then(res => res.json())
        .then(data => {
            console.log("Face result:", data);

            if(data.success){
                clearInterval(interval);
                stopCamera();

                // 🔥 FIXED
                window.top.location.href = "/dashboard";
            }
        });

        attempts++;

        if(attempts >= 5){
            clearInterval(interval);
            stopCamera();
            alert("Face not recognized ❌");
            closeFaceScan();
        }

    }, 2000);
}


// ================= CLOSE MODAL =================

function closeFaceScan(){
    document.getElementById("faceModal").style.display = "none";
    stopCamera();
}


// ================= STOP CAMERA =================

function stopCamera(){
    if(videoStream){
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}


// ================= GOOGLE LOGIN =================

function googleLogin(){

    const provider = new firebase.auth.GoogleAuthProvider();

    firebase.auth().signInWithPopup(provider)
    .then(result => {

        const email = result.user.email;

        console.log("Google user:", email);

        // SEND TO BACKEND
        fetch('/google-login', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({email})
        })
        .then(res => res.json())
        .then(data => {
            if(data.success){

                // 🔥 FIXED
                window.top.location.href = "/dashboard";
            }
        });

    })
    .catch(err => {
        console.error(err);
        alert(err.message);
    });
}