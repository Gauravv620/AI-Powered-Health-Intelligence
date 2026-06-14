// ================= SMOOTH SCROLL =================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: "smooth" });
        }
    });
});


// ================= TYPING =================
const texts = ["Predict diseases", "AI insights", "Smart diet"];
let i = 0, j = 0, del = false;

const typingEl = document.getElementById("typing");

function type() {
    if (!typingEl) return;

    let t = texts[i];

    typingEl.innerHTML =
        del ? t.substring(0, j--) : t.substring(0, j++);

    if (j === t.length) del = true;
    if (j === 0) {
        del = false;
        i = (i + 1) % texts.length;
    }

    setTimeout(type, del ? 50 : 100);
}
type();


// ================= AI DEMO =================
const demo = ["Low Risk", "BMI Normal", "Healthy Diet"];
let k = 0;

const demoEl = document.getElementById("demoText");

setInterval(() => {
    if (demoEl) {
        demoEl.innerText = demo[k];
        k = (k + 1) % demo.length;
    }
}, 2000);


// ================= SCROLL REVEAL =================
const reveals = document.querySelectorAll(".reveal");

function revealOnScroll() {
    reveals.forEach(el => {
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight - 80) {
            el.classList.add("active");
        }
    });
}

window.addEventListener("scroll", revealOnScroll);
revealOnScroll(); // run on load


// ================= 3D TILT EFFECT (IMPROVED) =================
document.querySelectorAll(".tilt").forEach(card => {

    card.addEventListener("mousemove", (e) => {

        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = -(y - centerY) / 12;
        const rotateY = (x - centerX) / 12;

        card.style.transform =
            `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    });

    card.addEventListener("mouseleave", () => {
        card.style.transform =
            "perspective(1000px) rotateX(0) rotateY(0) scale(1)";
    });
});


// ================= OPTIONAL PARALLAX HERO =================
window.addEventListener("scroll", () => {
    const video = document.querySelector(".bg-video");
    if (video) {
        video.style.transform = `translateY(${window.scrollY * 0.2}px)`;
    }
});


// ================= SCROLL REVEAL =================
window.addEventListener("scroll",()=>{
    document.querySelectorAll(".card, .box, .step").forEach(el=>{
        if(el.getBoundingClientRect().top < window.innerHeight-80){
            el.style.opacity="1";
            el.style.transform="translateY(0)";
        }
    });
});

// INITIAL STATE
document.querySelectorAll(".card, .box, .step").forEach(el=>{
    el.style.opacity="0";
    el.style.transform="translateY(40px)";
    el.style.transition="0.6s";
});


// SCROLL REVEAL
window.addEventListener("scroll",()=>{
    document.querySelectorAll(".reveal").forEach(el=>{
        if(el.getBoundingClientRect().top < window.innerHeight-80){
            el.classList.add("active");
        }
    });
});

// TILT EFFECT
document.querySelectorAll(".tilt").forEach(card=>{
    card.addEventListener("mousemove",(e)=>{
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = -(y - centerY) / 15;
        const rotateY = (x - centerX) / 15;

        card.style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.08)`;
    });

    card.addEventListener("mouseleave",()=>{
        card.style.transform =
        "perspective(1000px) rotateX(0) rotateY(0) scale(1)";
    });
});


// ===== HEALTH SCORE RING =====
let score = 0;
let target = 87;
let ring = document.querySelector(".ring");
let scoreVal = document.getElementById("scoreVal");

let scoreAnim = setInterval(()=>{
    score++;
    scoreVal.innerText = score + "%";

    ring.style.background =
    `conic-gradient(#00c6ff ${score*3.6}deg, rgba(255,255,255,0.1) ${score*3.6}deg)`;

    if(score>=target) clearInterval(scoreAnim);
},20);


// ===== LINE CHART (REAL-TIME) =====
let data = [60,65,70,72,75,80];

const lineChart = new Chart(document.getElementById("lineChart"),{
    type:'line',
    data:{
        labels:["","","","","",""],
        datasets:[{
            data:data,
            borderColor:"#00c6ff",
            tension:0.4
        }]
    },
    options:{animation:false}
});

setInterval(()=>{
    let next = data[data.length-1] + (Math.random()*6-3);
    data.push(next);
    data.shift();
    lineChart.update();
},1500);


// ===== PIE LIVE =====
const pieChart = new Chart(document.getElementById("pieChart"),{
    type:'doughnut',
    data:{
        labels:["Protein","Carbs","Fats"],
        datasets:[{
            data:[40,35,25],
            backgroundColor:["#00c6ff","#0072ff","#00ffcc"]
        }]
    }
});

setInterval(()=>{
    let a = Math.random()*50;
    let b = Math.random()*30;
    let c = 100-a-b;
    pieChart.data.datasets[0].data=[a,b,c];
    pieChart.update();
},3000);


// ===== ECG WAVE =====
let ecgData = Array(50).fill(50);

const ecgChart = new Chart(document.getElementById("ecgChart"),{
    type:'line',
    data:{
        labels:ecgData,
        datasets:[{
            data:ecgData,
            borderColor:"#00ffcc",
            pointRadius:0
        }]
    },
    options:{
        animation:false,
        scales:{x:{display:false},y:{display:false}}
    }
});

setInterval(()=>{
    let val = 50 + Math.random()*20;
    ecgData.push(val);
    ecgData.shift();
    ecgChart.data.datasets[0].data = ecgData;
    ecgChart.update();
},200);


// ===== AI STATUS TEXT =====
const statusText = [
    "Analyzing vitals...",
    "Processing data...",
    "Generating insights...",
    "System stable ✅"
];

let idx=0;
setInterval(()=>{
    document.getElementById("aiStatus").innerText = statusText[idx];
    idx=(idx+1)%statusText.length;
},2000);


// ===== ALERT POPUP =====
setInterval(()=>{
    const alertBox = document.getElementById("alertBox");
    alertBox.style.display="block";

    setTimeout(()=>{
        alertBox.style.display="none";
    },3000);

},10000);


// ===== WAVE SECTION ANIMATION =====
window.addEventListener("scroll", () => {
    document.querySelectorAll(".brand-wave").forEach(el => {
        if (el.getBoundingClientRect().top < window.innerHeight - 100) {
            el.classList.add("active");
        }
    });
});


// ================= AUTH MODAL =================


// OPEN LOGIN
function openLogin(){
    const modal = document.getElementById("authModal");
    const frame = document.getElementById("authFrame");

    frame.src = "/login";     // set first
    modal.style.display = "flex";
}

// OPEN SIGNUP
function openSignup(){
    const modal = document.getElementById("authModal");
    const frame = document.getElementById("authFrame");

    frame.src = "/signup";
    modal.style.display = "flex";
}

// CLOSE MODAL
function closeModal(){
    const modal = document.getElementById("authModal");
    const frame = document.getElementById("authFrame");

    modal.style.display = "none";

    // 🔥 HARD RESET (important)
    frame.src = "about:blank";
}


// 🔥 FORCE RESET ON LOAD (VERY IMPORTANT)
document.addEventListener("DOMContentLoaded", () => {
    const modal = document.getElementById("authModal");
    const frame = document.getElementById("authFrame");

    if(modal) modal.style.display = "none";
    if(frame) frame.src = "about:blank";   // prevents old page (dashboard)
});


// 🔥 CLOSE WHEN CLICK OUTSIDE
window.addEventListener("click", (e) => {
    const modal = document.getElementById("authModal");

    if (e.target === modal) {
        closeModal();
    }
});