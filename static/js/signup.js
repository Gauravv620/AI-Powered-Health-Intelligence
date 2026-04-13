function signup() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!email || !password) {
        alert("Fill all fields");
        return;
    }

    fetch('/signup-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("Account created ✅");
            window.location = "/login";   // 🔥 redirect
        } else {
            alert(data.message);
        }
    });
}