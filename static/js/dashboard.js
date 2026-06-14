let chart;
let gaugeChart;
let gaugeInterval; // 🔥 fix: prevent multiple animations
let uploadedData = []; // 🔥 global
let selectedIndex = -1;
let currentSlide = 0;
let aiTimer = null;

// ================= ANALYZE =================
function analyze() {

    const bpInput = document.getElementById("bp");
    const bpVal = bpInput.value.trim();
    const bpPattern = /^\d{2,3}\/\d{2,3}$/;
    if (!bpPattern.test(bpVal)) {
        alert("Blood Pressure must be in the format 'Systolic/Diastolic' (e.g., 120/80 or 120/50)");
        bpInput.focus();
        return;
    }
    const systolic = parseFloat(bpVal.split("/")[0]) || 0;

    const data = {
        age: +document.getElementById("age").value,
        bmi: +document.getElementById("bmi").value,
        glucose: +document.getElementById("glucose").value,
        hba1c: +document.getElementById("hba1c").value,
        bp: systolic,
        cholesterol: +document.getElementById("cholesterol").value,
        maxhr: +document.getElementById("maxhr").value,
        hypertension: +document.getElementById("hypertension").value
    };

    fetch('/multi-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(r => {

            console.log("Prediction:", r);
            window.latestScore = r.health_score;


            // ===== TEXT OUTPUT =====
            document.getElementById("diabetes").innerText =
                r.diabetes ? "High Risk ⚠" : "Normal ✅";

            document.getElementById("heart").innerText =
                r.heart ? "High Risk ⚠" : "Normal ✅";

            document.getElementById("bpRisk").innerText =
                "BP Risk Score: " + r.bp_score;

            // ===== HEALTH SCORE =====
            const scoreEl = document.getElementById("healthScore");

            scoreEl.innerText = "Overall Score: " + r.health_score + "/100";

            scoreEl.classList.remove("green", "yellow", "red");

            if (r.health_score >= 80) {
                scoreEl.classList.add("green");
            }
            else if (r.health_score >= 50) {
                scoreEl.classList.add("yellow");
            }
            else {
                scoreEl.classList.add("red");
            }

            // ===== GAUGE =====
            renderGauge(r.health_score);

            updateECG(r.health_score);



            // ===== BAR CHART (FIXED + REALISTIC) =====
            if (chart) chart.destroy();

            const chartCanvas = document.getElementById("chart");

            if (chartCanvas) {
                chart = new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: ["Diabetes", "Heart", "BP"],
                        datasets: [{
                            label: "Risk %",
                            data: [
                                r.diabetes ? 100 : 0,
                                r.heart ? 100 : 0,
                                r.bp_score
                            ],
                            backgroundColor: [
                                "#ff4d4d",
                                "#ffcc00",
                                "#00c6ff"
                            ],
                            borderRadius: 10
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: { duration: 600 },
                        plugins: {
                            legend: { labels: { color: "white" } }
                        },
                        scales: {
                            y: {
                                min: 0,
                                max: 100,
                                ticks: { color: "white" },
                                grid: { color: "rgba(255,255,255,0.1)" }
                            },
                            x: {
                                ticks: { color: "white" },
                                grid: { color: "rgba(255,255,255,0.05)" }
                            }
                        }
                    }
                });
            }
            // ===== AI RECOMMENDATION =====
            let diet = "";

            if (r.diabetes) diet += "• Reduce sugar intake\n";
            if (r.heart) diet += "• Avoid oily food\n";
            if (r.bp_score > 30) diet += "• Reduce salt & stress\n";

            if (r.health_score < 50) {
                diet += "\n⚠ High risk: Consult doctor";
            }
            else if (r.health_score < 75) {
                diet += "\n⚠ Moderate: Improve lifestyle";
            }
            else {
                diet += "\n✅ Good health";
            }


            window.latestData = {
                glucose: data.glucose,
                bp: data.bp,
                cholesterol: data.cholesterol,
                bmi: data.bmi
            };

            updateInsights({
                glucose: data.glucose,
                hba1c: data.hba1c,
                bp: data.bp,
                cholesterol: data.cholesterol,
                bmi: data.bmi,
                age: data.age,
                maxhr: data.maxhr,
                diabetes: r.diabetes,
                heart: r.heart,
                bp_score: r.bp_score,
                health_score: r.health_score
            });


            renderAIExplanation({
                glucose: data.glucose,
                hba1c: data.hba1c,
                bp: data.bp,
                cholesterol: data.cholesterol,
                bmi: data.bmi,
                age: data.age,
                maxhr: data.maxhr,
                diabetes: r.diabetes,
                heart: r.heart,
                bp_score: r.bp_score,
                health_score: r.health_score
            });


            renderAgeHealthChart();

        })
        .catch(err => {
            console.error("Prediction error:", err);
        });
}




// ================= GAUGE =================
function renderGauge(score) {

    const color =
        score >= 80 ? "#00ff99" :
            score >= 50 ? "#ffcc00" :
                "#ff4d4d";

    if (gaugeChart) gaugeChart.destroy();

    gaugeChart = new Chart(document.getElementById("healthGauge"), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [color, "#2c3e50"],
                borderWidth: 0
            }]
        },
        options: {
            cutout: "75%",
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });

    // ===== GLOW =====
    const glow = document.getElementById("gaugeGlow");

    if (glow) {
        glow.className = "";
        glow.classList.add("gauge-glow-base");

        if (score >= 80) {
            glow.classList.add("glow-green");
        }
        else if (score >= 50) {
            glow.classList.add("glow-yellow");
        }
        else {
            glow.classList.add("glow-red");
        }
    }

    // ===== NUMBER ANIMATION =====
    animateGaugeNumber(score);
}


// ================= GAUGE NUMBER =================
function animateGaugeNumber(score) {

    const el = document.getElementById("gaugeValue");

    clearInterval(gaugeInterval); // 🔥 fix

    let current = 0;
    el.innerText = "0";

    gaugeInterval = setInterval(() => {
        current++;
        el.innerText = current;

        if (current >= score) {
            clearInterval(gaugeInterval);
        }
    }, 15);
}


// ================= HEARTBEAT =================
function updateHeartbeat(score) {

    const el = document.getElementById("heartbeat");
    if (!el) return;

    el.classList.remove("beat-green", "beat-yellow", "beat-red");

    if (score >= 80) {
        el.classList.add("beat-green");
    }
    else if (score >= 50) {
        el.classList.add("beat-yellow");
    }
    else {
        el.classList.add("beat-red");
    }

    // 🔥 play sound only for danger
    if (score < 50) {
        playHeartbeatSound();
        vibrateDevice([100, 50, 100]);
    }
}



// ================= SOUND =================
function playHeartbeatSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.value = 120;

        osc.connect(gain);
        gain.connect(ctx.destination);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);

        osc.start();
        osc.stop(ctx.currentTime + 0.08);
    } catch (e) { }
}


// ================= VIBRATION =================
function vibrateDevice(pattern) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}


// ================= UPLOAD =================
function uploadFile() {

    const file = document.getElementById("fileInput").files[0];

    const formData = new FormData();
    formData.append("file", file);

    fetch('/upload-report', {
        method: 'POST',
        body: formData
    })
        .then(res => res.json())
        .then(data => {

            uploadedData = data.data; // 🔥 full dataset

            const first = data.first; // 🔥 first row

            // autofill
            document.getElementById("age").value = first.age || "";
            document.getElementById("bmi").value = first.bmi || "";
            document.getElementById("glucose").value = first.glucose || "";
            document.getElementById("hba1c").value = first.hba1c || "";
            
            let bpVal = first.bp || "";
            if (bpVal && !String(bpVal).includes("/")) {
                bpVal = bpVal + "/80";
            }
            document.getElementById("bp").value = bpVal;
            
            document.getElementById("cholesterol").value = first.cholesterol || "";
            document.getElementById("maxhr").value = first.maxhr || "";
            document.getElementById("hypertension").value = first.hypertension || "";

            renderAgeHealthChart(); // 🔥 chart now works

            analyze();
        });
}

// ================= THEME =================
function toggleTheme() {
    document.body.classList.toggle("light");
}



function updateECG(score) {
    const path = document.querySelector(".ecg path");
    if (!path) return;

    if (score >= 80) {
        path.style.stroke = "#00ff99"; // green
    }
    else if (score >= 50) {
        path.style.stroke = "#ffcc00"; // yellow
    }
    else {
        path.style.stroke = "#ff4d4d"; // red
    }
}


// ================= SIMULATION =================
let simInterval = null;
let simRunning = false;

function toggleSimulation() {
    const btn = document.getElementById("simBtn");

    if (simRunning) {
        clearInterval(simInterval);
        simRunning = false;
        btn.innerText = "▶ Start Simulation";
        return;
    }

    simRunning = true;
    btn.innerText = "⏸ Stop Simulation";

    simInterval = setInterval(runSimulation, 2000);
}


// ================= CORE SIMULATION =================
function runSimulation() {

    const age = randomRange(20, 70);
    const bmi = randomRange(18, 35);
    const glucose = randomRange(80, 220);
    const hba1c = randomRange(4.5, 10);
    const bp = randomRange(90, 180);
    const cholesterol = randomRange(150, 300);
    const maxhr = randomRange(90, 180);
    const hypertension = bp > 140 ? 1 : 0;

    setVal("age", age);
    setVal("bmi", bmi);
    setVal("glucose", glucose);
    setVal("hba1c", hba1c);
    setVal("bp", `${bp}/${randomRange(60, 95)}`);
    setVal("cholesterol", cholesterol);
    setVal("maxhr", maxhr);
    setVal("hypertension", hypertension);

    const diabetes = glucose > 160 || hba1c > 7 ? 1 : 0;
    const heart = (bp > 140 || cholesterol > 240) ? 1 : 0;

    const bp_score = calcBP(bp, age, bmi);
    const final_score = calcHealth(diabetes, heart, bp_score);

    window.latestData = {
        glucose,
        hba1c,
        bp,
        cholesterol,
        bmi,
        age,
        maxhr,
        diabetes,
        heart,
        bp_score,
        health_score: final_score
    };

    // 🔥 FIRST UI
    updateUI(diabetes, heart, bp_score, final_score);

    // 🔥 THEN AI
    renderAIExplanation({
        glucose,
        hba1c,
        bp,
        cholesterol,
        bmi,
        age,
        maxhr,
        diabetes,
        heart,
        bp_score,
        health_score: final_score
    });
}



// ================= HELPERS =================
function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}


// ================= LOCAL LOGIC (MATCH BACKEND) =================
function calcBP(bp, age, bmi) {
    let score = 0;

    if (bp < 120) score += 0;
    else if (bp < 130) score += 10;
    else if (bp < 140) score += 25;
    else score += 40;

    if (age > 45) score += 10;
    if (age > 60) score += 10;

    if (bmi > 25) score += 10;
    if (bmi > 30) score += 10;

    return Math.min(score, 100);
}

function calcHealth(diabetes, heart, bp_score) {
    let score = 100;

    if (diabetes) score -= 30;
    if (heart) score -= 30;

    score -= Math.floor(bp_score * 0.3);

    return Math.max(score, 0);
}


// ================= UI UPDATE =================
function updateUI(diabetes, heart, bp_score, score) {

    document.getElementById("diabetes").innerText =
        diabetes ? "High Risk ⚠" : "Normal ✅";

    document.getElementById("heart").innerText =
        heart ? "High Risk ⚠" : "Normal ✅";

    document.getElementById("bpRisk").innerText =
        "BP Risk Score: " + bp_score;

    const scoreEl = document.getElementById("healthScore");
    scoreEl.innerText = "Overall Score: " + score + "/100";

    scoreEl.classList.remove("green", "yellow", "red");

    if (score >= 80) scoreEl.classList.add("green");
    else if (score >= 50) scoreEl.classList.add("yellow");
    else scoreEl.classList.add("red");

    // ===== VISUALS =====
    renderGauge(score);
    updateHeartbeat(score);
    updateECG(score);
    updateVitals(score);
    renderAgeHealthChart();

    // ================= FIX 1: BAR CHART =================
    if (chart) chart.destroy();

    const ctx = document.getElementById("chart");

    if (ctx) {
        chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ["Diabetes", "Heart", "BP"],
                datasets: [{
                    label: "Risk %",
                    data: [
                        diabetes ? 100 : 0,
                        heart ? 100 : 0,
                        bp_score
                    ],
                    backgroundColor: [
                        "#ff4d4d",
                        "#ffcc00",
                        "#00c6ff"
                    ],
                    borderRadius: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600 },
                plugins: {
                    legend: { labels: { color: "white" } }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: "white" },
                        grid: { color: "rgba(255,255,255,0.1)" }
                    },
                    x: {
                        ticks: { color: "white" },
                        grid: { color: "rgba(255,255,255,0.05)" }
                    }
                }
            }
        });
    }

    // ================= FIX 2: HEALTH INSIGHTS =================
    let bpText = document.getElementById("bp").value;
    let bpSystolic = bpText.includes("/") ? parseFloat(bpText.split("/")[0]) : parseFloat(bpText);
    if (isNaN(bpSystolic)) bpSystolic = 0;

    updateInsights({
        glucose: +document.getElementById("glucose").value,
        hba1c: +document.getElementById("hba1c").value,
        bp: bpSystolic,
        cholesterol: +document.getElementById("cholesterol").value,
        bmi: +document.getElementById("bmi").value,
        age: +document.getElementById("age").value,
        maxhr: +document.getElementById("maxhr").value,
        diabetes: diabetes,
        heart: heart,
        bp_score: bp_score,
        health_score: score
    });
}

// ================= BPM + STATUS =================
function updateVitals(score) {

    // 🔥 BPM logic (based on risk)
    let bpm;

    if (score >= 80) {
        bpm = randomRange(60, 80);   // healthy
    }
    else if (score >= 50) {
        bpm = randomRange(80, 100);  // moderate
    }
    else {
        bpm = randomRange(100, 140); // critical
    }

    document.getElementById("bpmValue").innerText = bpm;

    // 🔥 STATUS
    const statusEl = document.getElementById("patientStatus");

    statusEl.classList.remove("status-good", "status-warning", "status-danger");

    if (score >= 80) {
        statusEl.innerText = "Stable";
        statusEl.classList.add("status-good");
    }
    else if (score >= 50) {
        statusEl.innerText = "Warning";
        statusEl.classList.add("status-warning");
    }
    else {
        statusEl.innerText = "Critical";
        statusEl.classList.add("status-danger");
    }
}



// ================= AGE vs HEALTH CHART =================
let ageHealthChart;

function renderAgeHealthChart() {

    if (!uploadedData || uploadedData.length === 0) {
        console.warn("No dataset loaded");
        return;
    }

    console.log("Chart Data:", uploadedData);

    const ctx = document.getElementById("ageHealthChart");

    const labels = uploadedData.map((_, i) => i);

    function getVal(d, keys) {
        for (let key of keys) {
            if (d[key] !== undefined && d[key] !== null) {
                return parseFloat(d[key]) || 0;
            }
        }
        return 0;
    }

    const ages = uploadedData.map(d => getVal(d, ["age"]));

    const scores = uploadedData.map(d => {

        const glucose = getVal(d, ["glucose", "bloodglucose"]);
        const hba1c = getVal(d, ["hba1c", "hba1clevel", "hb"]);
        const bp = getVal(d, ["bp", "bloodpressure", "pressure"]);
        const cholesterol = getVal(d, ["cholesterol"]);
        const bmi = getVal(d, ["bmi"]);
        const age = getVal(d, ["age"]);

        let risk = 0;

        if (glucose > 160) risk += 20;
        if (hba1c > 7) risk += 20;
        if (bp > 140) risk += 15;
        if (cholesterol > 240) risk += 15;
        if (bmi > 30) risk += 10;
        if (age > 60) risk += 10;

        let score = 100 - risk;

        return Math.max(30, score);
    });

    if (ageHealthChart) ageHealthChart.destroy();

    ageHealthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Health Score',
                    data: scores,
                    borderColor: '#00ffcc',
                    backgroundColor: 'rgba(0,255,204,0.15)',
                    tension: 0.4,
                    fill: true,

                    // 🔥 dynamic point styling
                    pointRadius: (ctx) =>
                        ctx.dataIndex === selectedIndex ? 10 : 4,

                    pointBackgroundColor: (ctx) =>
                        ctx.dataIndex === selectedIndex ? '#ffffff' : '#00ffcc',

                    pointBorderWidth: (ctx) =>
                        ctx.dataIndex === selectedIndex ? 3 : 1,

                    pointBorderColor: '#00ffcc',

                    // glow effect
                    pointHoverRadius: 12
                },
                {
                    label: 'Age',
                    data: ages,
                    borderColor: '#ff4d6d',
                    backgroundColor: 'rgba(255,77,109,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: 'nearest',
                intersect: false
            },

            onClick: (event) => {

                const points = ageHealthChart.getElementsAtEventForMode(
                    event,
                    'nearest',
                    { intersect: false },
                    true
                );

                if (!points.length) return;

                const index = points[0].index;
                selectedIndex = index;

                const patient = uploadedData[index];

                // 🔥 LOCK (prevent chart reset)
                window.isChartClick = true;

                fillFormFromRow(patient);

                const reason = getRiskReason(patient);
                const el = document.getElementById("riskReason");

                if (el) {
                    el.innerText = reason;

                    if (reason.includes("Healthy")) el.style.color = "#00ff99";
                    else if (reason.includes("High")) el.style.color = "#ff4d4d";
                    else el.style.color = "#ffcc00";
                }

                // 🔥 APPLY ZOOM AFTER analyze() completes
                setTimeout(() => {

                    const total = uploadedData.length;

                    const start = Math.max(index - 2, 0);
                    const end = Math.min(index + 2, total - 1);

                    ageHealthChart.options.scales.x.min = start;
                    ageHealthChart.options.scales.x.max = end;

                    ageHealthChart.update('none');

                    window.isChartClick = false;

                }, 200);
            },

            plugins: {
                legend: {
                    labels: { color: "white" }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.raw}`,
                        afterLabel: (ctx) => {
                            const patient = uploadedData[ctx.dataIndex];
                            return getRiskReason(patient);
                        }
                    }
                }
            },

            scales: {
                x: {
                    type: 'linear',
                    ticks: {
                        color: "white",
                        callback: (val) => "P" + (val + 1)
                    },
                    grid: { color: "rgba(255,255,255,0.1)" }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { color: "white" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                }
            }
        }
    });

    console.log("DATA:", uploadedData);
}


// ================= FILL FORM =================
function fillFormFromRow(d) {

    function getVal(obj, keys) {
        for (let k of keys) {
            if (obj[k] !== undefined && obj[k] !== null) {
                return parseFloat(obj[k]) || 0;
            }
        }
        return 0;
    }

    document.getElementById("age").value = getVal(d, ["age"]);
    document.getElementById("bmi").value = getVal(d, ["bmi"]);
    document.getElementById("glucose").value = getVal(d, ["glucose", "bloodglucose"]);
    document.getElementById("hba1c").value = getVal(d, ["hba1c", "hba1clevel", "hb"]);
    
    let bpVal = getVal(d, ["bp", "bloodpressure", "pressure"]);
    if (bpVal && !String(bpVal).includes("/")) {
        bpVal = bpVal + "/80";
    }
    document.getElementById("bp").value = bpVal;
    
    document.getElementById("cholesterol").value = getVal(d, ["cholesterol"]);
    document.getElementById("maxhr").value = getVal(d, ["maxhr", "heartrate", "maxheartrate"]);
    document.getElementById("hypertension").value = getVal(d, ["hypertension"]);

    // 🔥 only run analyze if NOT chart click
    if (!window.isChartClick) {
        analyze();
    }
}



// ================= RISK REASON =================
function getRiskReason(d) {

    function getVal(obj, keys) {
        for (let k of keys) {
            if (obj[k] !== undefined && obj[k] !== null) {
                return parseFloat(obj[k]) || 0;
            }
        }
        return 0;
    }

    const glucose = getVal(d, ["glucose", "bloodglucose"]);
    const hba1c = getVal(d, ["hba1c", "hba1clevel", "hb"]);
    const bp = getVal(d, ["bp", "bloodpressure", "pressure"]);
    const cholesterol = getVal(d, ["cholesterol"]);
    const bmi = getVal(d, ["bmi"]);
    const age = getVal(d, ["age"]);

    let reasons = [];

    if (glucose > 160) reasons.push("High Glucose");
    if (hba1c > 7) reasons.push("High HbA1c");
    if (bp > 140) reasons.push("High Blood Pressure");
    if (cholesterol > 240) reasons.push("High Cholesterol");
    if (bmi > 30) reasons.push("High BMI (Obesity)");
    if (age > 60) reasons.push("Age Risk");

    if (reasons.length === 0) {
        return "✅ Healthy – No major risk detected";
    }

    return "⚠ Risk due to: " + reasons.join(", ");
}



// ================= RESET ZOOM =================
function resetZoom() {

    if (!ageHealthChart) return;

    // clear zoom range
    ageHealthChart.options.scales.x.min = undefined;
    ageHealthChart.options.scales.x.max = undefined;

    // reset selected point
    selectedIndex = -1;

    // IMPORTANT: no animation (prevents glitch)
    ageHealthChart.update('none');
}



function showSlide(index) {
    const slides = document.querySelectorAll(".slide");

    slides.forEach(s => {
        s.classList.remove("active");
        s.style.display = "none";
    });

    currentSlide = (index + slides.length) % slides.length;

    const activeSlide = slides[currentSlide];

    activeSlide.classList.add("active");
    activeSlide.style.display = "block";

    // 🔥 FIX: render chart ONLY when slide 3 is active
    if (activeSlide.id === "conditionSlide") {
        setTimeout(() => {
            renderConditionChart(window.latestData); // important
        }, 100);
    }
}

function nextSlide() {
    showSlide(currentSlide + 1);
}

function prevSlide() {
    showSlide(currentSlide - 1);
}


let conditionChart;

function renderConditionChart(data) {

    const ctx = document.getElementById("conditionChart");

    if (conditionChart) conditionChart.destroy();

    conditionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Diabetes', 'Heart', 'BP', 'Cholesterol', 'BMI'],
            datasets: [{
                data: [
                    data.glucose > 150 ? 1 : 0,
                    data.bp > 140 ? 1 : 0,
                    data.bp > 130 ? 1 : 0,
                    data.cholesterol > 240 ? 1 : 0,
                    data.bmi > 25 ? 1 : 0
                ],
                backgroundColor: [
                    '#ff4d6d',
                    '#3498db',
                    '#f1c40f',
                    '#2ecc71',
                    '#9b59b6'
                ]
            }]
        },

        // 🔥 ADD THIS BLOCK HERE
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}


function makeCard(title, text, level = "mid", delay = 0) {
    return `
    <div class="insight-card ${level}" style="animation-delay:${delay}ms">
        <div class="insight-title">${title}</div>
        <div class="insight-text">${text}</div>
    </div>`;
}

function updateInsights(data) {

    let dietHTML = "";
    let lifeHTML = "";
    let d = 0;

    function makeCard(title, text, level = "mid", delay = 0) {
        return `
        <div class="insight-card ${level}" style="animation-delay:${delay}ms">
            <div class="insight-title">${title}</div>
            <div class="insight-text">${text}</div>
        </div>`;
    }

    // ===== DIET (BACKEND BASED) =====
    if (data.diabetes)
        dietHTML += makeCard("Diabetes Risk", "Avoid sugar & refined carbs", "high", d += 120);

    if (data.heart)
        dietHTML += makeCard("Heart Risk", "Avoid oily & fried food", "high", d += 120);

    if (data.bp_score > 30)
        dietHTML += makeCard("High BP Risk", "Reduce salt intake", "high", d += 120);

    if (data.bmi > 25)
        dietHTML += makeCard("Weight Control", "Increase fiber & reduce calories", "mid", d += 120);

    if (data.health_score < 50)
        dietHTML += makeCard("Critical Health", "Strict diet plan required", "high", d += 120);

    else if (data.health_score < 75)
        dietHTML += makeCard("Moderate Health", "Balanced diet needed", "mid", d += 120);

    else
        dietHTML += makeCard("Healthy", "Maintain current diet", "good", d += 120);

    document.getElementById("dietList").innerHTML = dietHTML;


    // ===== LIFESTYLE (BACKEND BASED) =====
    d = 0;

    if (data.heart)
        lifeHTML += makeCard("Cardio Needed", "Do daily walking / jogging", "high", d += 120);

    if (data.bp_score > 30)
        lifeHTML += makeCard("Stress Control", "Practice yoga & meditation", "high", d += 120);

    if (data.diabetes)
        lifeHTML += makeCard("Sugar Monitoring", "Check glucose regularly", "high", d += 120);

    if (data.maxhr < 100)
        lifeHTML += makeCard("Low Fitness", "Improve cardiovascular endurance", "mid", d += 120);

    if (data.health_score < 50)
        lifeHTML += makeCard("Immediate Action", "Consult doctor", "high", d += 120);

    else if (data.health_score < 75)
        lifeHTML += makeCard("Lifestyle Improve", "Exercise regularly", "mid", d += 120);

    else
        lifeHTML += makeCard("Good Lifestyle", "Keep consistency", "good", d += 120);

    lifeHTML += makeCard("General", "Sleep 7–8 hrs & stay hydrated", "good", d += 120);

    document.getElementById("lifestyleList").innerHTML = lifeHTML;


    // ===== CONDITION CHART (UNCHANGED) =====
    renderConditionChart(data);
}






// ================= AI EXPLANATION =================

function renderAIExplanation(data) {

    const el = document.getElementById("aiExplain");
    if (!el) return;

    let status = "";
    let statusClass = "";

    if (data.health_score >= 80) {
        status = "Good Health";
        statusClass = "good";
    }
    else if (data.health_score >= 50) {
        status = "Moderate Risk";
        statusClass = "mid";
    }
    else {
        status = "High Risk";
        statusClass = "high";
    }

    let factors = "";
    if (data.diabetes) factors += "<li>High glucose / HbA1c</li>";
    if (data.heart) factors += "<li>Heart risk</li>";
    if (data.bp_score > 30) factors += "<li>Blood pressure risk</li>";
    if (data.bmi > 30) factors += "<li>Obesity risk</li>";
    if (data.age > 60) factors += "<li>Age factor</li>";

    let tips = "";
    if (data.diabetes) tips += "<li>Reduce sugar intake</li>";
    if (data.heart) tips += "<li>Avoid oily food</li>";
    if (data.bp_score > 30) tips += "<li>Reduce salt & stress</li>";
    if (data.bmi > 25) tips += "<li>Exercise & increase fiber</li>";
    if (data.maxhr < 100) tips += "<li>Improve cardio fitness</li>";

    el.innerHTML = `
        <div class="ai-box ${statusClass}">
            <div class="ai-status">${status}</div>

            <div class="ai-section">
                <h4>🔎 Key Factors</h4>
                <ul>${factors || "<li>No major risks</li>"}</ul>
            </div>

            <div class="ai-section">
                <h4>💡 Recommendations</h4>
                <ul>${tips || "<li>Maintain current lifestyle</li>"}</ul>
            </div>
        </div>
    `;
}



































































// ================= CHAT =================
function toggleChat() {
    const box = document.getElementById("chatBox");
    box.style.display = box.style.display === "flex" ? "none" : "flex";
}

document.getElementById("chatInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
        sendMessage();
    }
});

function getLocalHealthReply(msg) {

    const m = msg.toLowerCase();

    // get latest analyzed data
    const d = window.latestData || {};
    const score = window.latestScore || null;

    // ===== BASIC GREET =====
    if (m.includes("hi") || m.includes("hello"))
        return "Hello! Ask me about your report, diet, BP, sugar, or fitness.";

    // ===== REPORT SUMMARY =====
    if (m.includes("report") || m.includes("how am i") || m.includes("health status")) {
        if (!score) return "Please analyze your report first.";
        if (score >= 80) return "Your health looks good. Maintain your lifestyle and diet.";
        if (score >= 50) return "Moderate risk detected. Improve diet, exercise regularly.";
        return "High risk detected. You should consult a doctor and improve habits urgently.";
    }

    // ===== SUGAR =====
    if (m.includes("sugar") || m.includes("glucose")) {
        if (!d.glucose) return "Upload or analyze report first.";
        if (d.glucose > 160) return "Your sugar is high. Avoid sweets, refined carbs, and monitor regularly.";
        return "Your sugar level looks normal.";
    }

    // ===== BP =====
    if (m.includes("bp") || m.includes("pressure")) {
        if (!d.bp) return "Upload or analyze report first.";
        if (d.bp > 140) return "High BP detected. Reduce salt, stress, and exercise daily.";
        return "Your BP is within normal range.";
    }

    // ===== CHOLESTEROL =====
    if (m.includes("cholesterol")) {
        if (!d.cholesterol) return "Upload report first.";
        if (d.cholesterol > 240) return "High cholesterol. Avoid oily food and add omega-3.";
        return "Cholesterol looks normal.";
    }

    // ===== BMI / WEIGHT =====
    if (m.includes("bmi") || m.includes("weight")) {
        if (!d.bmi) return "Upload report first.";
        if (d.bmi > 30) return "Obesity risk. Start weight loss with diet and exercise.";
        if (d.bmi > 25) return "Overweight. Improve diet and increase activity.";
        return "Your BMI is healthy.";
    }

    // ===== HEART =====
    if (m.includes("heart")) {
        if (!d.bp && !d.cholesterol) return "Analyze report first.";
        if (d.bp > 140 || d.cholesterol > 240)
            return "Heart risk present. Control BP, cholesterol, and stay active.";
        return "Heart risk appears low.";
    }

    // ===== DIET =====
    if (m.includes("diet") || m.includes("what should i eat")) {
        return "Eat fruits, vegetables, whole grains, and avoid sugar, salt, and oily food.";
    }

    // ===== EXERCISE =====
    if (m.includes("exercise") || m.includes("workout")) {
        return "Do at least 30 min daily exercise like walking, jogging, or cycling.";
    }

    // ===== SLEEP =====
    if (m.includes("sleep")) {
        return "Sleep 7–8 hours daily for better recovery and health.";
    }

    // ===== DEFAULT =====
    return null; // means fallback to API
}

function sendMessage() {

    const input = document.getElementById("chatInput");
    const msg = input.value.trim();

    if (!msg) return;

    const chat = document.getElementById("chatMessages");

    const userDiv = document.createElement("div");
    userDiv.className = "user-msg";
    userDiv.innerText = msg;
    chat.appendChild(userDiv);

    input.value = "";

    // 🔥 CHECK LOCAL RESPONSE FIRST
    const localReply = getLocalHealthReply(msg);

    if (localReply) {
        const aiDiv = document.createElement("div");
        aiDiv.className = "ai-msg";
        aiDiv.innerText = localReply;
        chat.appendChild(aiDiv);
        return;
    }

    // 🔥 FALLBACK TO API
    const typingDiv = document.createElement("div");
    typingDiv.className = "ai-msg typing";
    typingDiv.innerText = "AI is typing...";
    chat.appendChild(typingDiv);

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
    })
        .then(res => res.json())
        .then(data => {

            typingDiv.remove();

            const aiDiv = document.createElement("div");
            aiDiv.className = "ai-msg";
            aiDiv.innerText = data.reply;

            chat.appendChild(aiDiv);
        });
}


function downloadReport() {

    console.log("🔥 Download clicked");  // DEBUG

    const aiText = document.getElementById("aiExplain")?.innerText || "";

    const data = {
        age: document.getElementById("age")?.value || 0,
        bmi: document.getElementById("bmi")?.value || 0,
        glucose: document.getElementById("glucose")?.value || 0,
        hba1c: document.getElementById("hba1c")?.value || 0,
        bp: document.getElementById("bp")?.value || 0,
        cholesterol: document.getElementById("cholesterol")?.value || 0,
        maxhr: document.getElementById("maxhr")?.value || 0,

        diabetes: document.getElementById("diabetes")?.innerText || "Normal",
        heart: document.getElementById("heart")?.innerText || "Normal",
        bpRisk: document.getElementById("bpRisk")?.innerText || "0",
        healthScore: document.getElementById("healthScore")?.innerText || "0",

        diet: document.getElementById("dietList")?.innerText || "",
        ai: aiText
    };

    console.log("📤 Sending:", data); // DEBUG

    fetch('/download-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(res => {
            console.log("✅ Response:", res.status); // DEBUG
            return res.json();
        })
        .then(r => {
            console.log("📄 Result:", r); // DEBUG

            if (!r.file) {
                alert("❌ PDF not generated");
                return;
            }

            window.open(r.file, '_blank');

            // Generate and show QR code scanner target below the download button
            if (r.qr_url) {
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(r.qr_url)}`;
                document.getElementById("qrcode").innerHTML = `<img src="${qrCodeUrl}" alt="Report QR Code" style="display:block; width:120px; height:120px;" />`;
                document.getElementById("qrContainer").style.display = "block";
            }

            if (typeof addToDownloadHistory === 'function') {
                addToDownloadHistory(r.file);
            }
        })
        .catch(err => {
            console.error("❌ Error:", err);
            alert("Error generating report");
        });
}