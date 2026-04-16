let barChart, gaugeChart, trendChart, ecgChart;
let ecgData = [];
let uploadedData = [];

// ---------------- UPLOAD ----------------
function uploadFile(){

  const f = document.getElementById("file").files[0];

  if(!f){
    alert("Select file first");
    return;
  }

  const fd = new FormData();
  fd.append("file", f);

  fetch('/upload-report', {
    method:'POST',
    body: fd
  })
  .then(res=>res.json())
  .then(data=>{

    console.log("DATA:", data);

    if(data.success){

      const x = data.data || {};
      uploadedData = data.rows || [];

      // ✅ FIXED KEY MAPPING
      setVal("pregnancies", x.pregnancies ?? x.Pregnancies);
      setVal("glucose", x.glucose ?? x.Glucose);
      setVal("blood_pressure", x.blood_pressure ?? x.BloodPressure);
      setVal("bmi", x.bmi ?? x.BMI);
      setVal("age", x.age ?? x.Age);

      // ✅ AUTO ANALYZE
      autoAnalyze();

      if(uploadedData.length > 1){
        renderTrendChart(uploadedData);
        renderSummary(data.summary);
      }

      alert("Report analyzed ✅");

    } else {
      alert(data.message);
    }

  })
  .catch(err=>{
    console.error(err);
    alert("Server error ❌");
  });
}

function setVal(id, v){
  document.getElementById(id).value = v || "";
}

// ---------------- AUTO ANALYZE ----------------
function autoAnalyze(){
  predict();
}

// ---------------- PREDICT ----------------
function predict(){

  const payload = {
    pregnancies: val("pregnancies"),
    glucose: val("glucose"),
    blood_pressure: val("blood_pressure"),
    bmi: val("bmi"),
    age: val("age")
  };

  fetch('/predict', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  })
  .then(res=>res.json())
  .then(d=>{
    renderResult(d);
    renderCharts(payload, d.score);
    renderRecommendations(payload);
    renderSummaryAuto(payload);
    updateHealthScore(d.score);
    saveHistory({...payload, score:d.score});
  });
}

function val(id){
  return Number(document.getElementById(id).value || 0);
}

// ---------------- RESULT ----------------
function renderResult(d){
  const badge = document.getElementById("riskBadge");

  badge.innerText = d.risk + " Risk";
  badge.className = "badge " + d.risk.toLowerCase();

  document.getElementById("scoreText").innerText = "Score: " + d.score;
}

// ---------------- ABNORMAL DETECTION ----------------
function classify(v, type){

  if(type === "glucose"){
    if(v > 160) return "bad";
    if(v > 120) return "warn";
    return "ok";
  }

  if(type === "bmi"){
    if(v > 30) return "bad";
    if(v > 25) return "warn";
    return "ok";
  }

  if(type === "bp"){
    if(v > 140) return "bad";
    if(v > 120) return "warn";
    return "ok";
  }

  return "ok";
}

// ---------------- SUMMARY AUTO ----------------
function renderSummaryAuto(p){

  const html = `
    <div class="val ${classify(p.glucose,'glucose')}">Glucose: ${p.glucose}</div>
    <div class="val ${classify(p.bmi,'bmi')}">BMI: ${p.bmi}</div>
    <div class="val ${classify(p.blood_pressure,'bp')}">BP: ${p.blood_pressure}</div>
    <div class="val ok">Age: ${p.age}</div>
  `;

  document.getElementById("summaryBox").innerHTML = html;
}

// ---------------- CHARTS ----------------
function renderCharts(p, score){

  if(barChart) barChart.destroy();

  barChart = new Chart(document.getElementById("barChart"), {
    type:'bar',
    data:{
      labels:['Pregnancies','Glucose','BP','BMI','Age'],
      datasets:[{
        label:"Health Metrics",
        data:[p.pregnancies,p.glucose,p.blood_pressure,p.bmi,p.age]
      }]
    }
  });

  if(gaugeChart) gaugeChart.destroy();

  gaugeChart = new Chart(document.getElementById("gaugeChart"), {
    type:'doughnut',
    data:{ datasets:[{ data:[score,1-score] }] },
    options:{ circumference:180, rotation:270 }
  });
}

// ---------------- TREND ----------------
function renderTrendChart(data){

  const labels = data.map((_, i) => i+1);
  const glucose = data.map(x => x.Glucose || x.glucose);
  const bmi = data.map(x => x.BMI || x.bmi);

  if(trendChart) trendChart.destroy();

  trendChart = new Chart(document.getElementById('trendChart'), {
    type:'line',
    data:{
      labels,
      datasets:[
        { label:'Glucose', data:glucose },
        { label:'BMI', data:bmi }
      ]
    }
  });
}

// ---------------- ECG ----------------
function initECG(){

  ecgChart = new Chart(document.getElementById("ecgChart"), {
    type:'line',
    data:{ labels:[], datasets:[{ data:ecgData }] },
    options:{ animation:false }
  });

  setInterval(()=>{
    const v = Math.sin(Date.now()/200) + Math.random();
    ecgData.push(v);

    if(ecgData.length > 50) ecgData.shift();

    ecgChart.update();
  },100);
}

// ---------------- GPT DOCTOR ----------------
async function getExplanation(){

  const payload = {
    pregnancies: val("pregnancies"),
    glucose: val("glucose"),
    blood_pressure: val("blood_pressure"),
    bmi: val("bmi"),
    age: val("age")
  };

  const res = await fetch('/ai-explain', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });

  const d = await res.json();
  document.getElementById("aiReport").innerText = d.text;
}

// ---------------- CHAT ----------------
function sendMessage(){

  const input = document.getElementById("chatInput");
  const msg = input.value;

  if(!msg) return;

  addMsg(msg, "user");

  fetch('/chat', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({message: msg})
  })
  .then(res=>res.json())
  .then(d=>{
    addMsg(d.reply, "bot");
  });

  input.value = "";
}

function addMsg(text, type){
  const box = document.getElementById("chatBox");

  const div = document.createElement("div");
  div.className = "msg " + type;
  div.innerText = text;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// ---------------- VOICE FIX ----------------
function startVoice(){

  const rec = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

  rec.onresult = (e)=>{
    const text = e.results[0][0].transcript;

    document.getElementById("voiceText").innerText = text;
    document.getElementById("chatInput").value = text;

    sendMessage(); // ✅ FIXED
  };

  rec.start();
}

// ---------------- HEALTH SCORE ----------------
function updateHealthScore(score){

  const percent = Math.round((1-score)*100);
  document.getElementById("scoreVal").innerText = percent + "%";

  const ring = document.querySelector(".ring");

  if(percent > 70) ring.style.borderColor = "green";
  else if(percent > 40) ring.style.borderColor = "orange";
  else ring.style.borderColor = "red";
}

// ---------------- HISTORY ----------------
function saveHistory(obj){
  let h = JSON.parse(localStorage.getItem("history")||"[]");
  h.push(obj);
  localStorage.setItem("history", JSON.stringify(h));
}

// ---------------- INIT ----------------
window.onload = function(){
  initECG();

  document.querySelectorAll("input").forEach(inp=>{
    inp.addEventListener("change", autoAnalyze);
  });
};