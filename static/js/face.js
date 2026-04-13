const video = document.getElementById("video");

// Access camera
navigator.mediaDevices.getUserMedia({ video: true })
.then(stream => {
    video.srcObject = stream;
});

// Simulate scanning → call backend
setTimeout(() => {
    fetch('/face-login')
    .then(res => res.json())
    .then(data => {
        if(data.success){
            alert("Face Verified ✅");
            window.location = "/dashboard";
        } else {
            alert("Face not recognized ❌");
            window.location = "/login";
        }
    });
}, 4000);